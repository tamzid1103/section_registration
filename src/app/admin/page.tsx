'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
    Users, ShieldAlert, Calendar, Settings, Bell, GraduationCap, 
    Download, TrendingUp, BookOpen, Layers, RefreshCw, ChevronRight, Check
} from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
    const supabase = createClient()

    const [selectedSemesterId, setSelectedSemesterId] = useState<string>('')
    const [stats, setStats] = useState({
        totalStudents: 0,
        selectedSemesterId: '',
        selectedSemesterName: 'None',
        isSelectedSemesterActive: false,
        isSelectedSemesterLocked: false,
        sectionsCount: 0,
        crCount: 0,
        pendingApps: 0,
    })
    const [auditLogs, setAuditLogs] = useState<any[]>([])
    const [advisorProgress, setAdvisorProgress] = useState<any[]>([])
    const [semesterHistory, setSemesterHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const selectedSemesterRef = useRef(selectedSemesterId)
    useEffect(() => {
        selectedSemesterRef.current = selectedSemesterId
    }, [selectedSemesterId])

    useEffect(() => {
        fetchSummary()
        const ch = supabase.channel('admin-dashboard-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => fetchSummary(selectedSemesterRef.current))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cr_applications' }, () => fetchSummary(selectedSemesterRef.current))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'semesters' }, () => fetchSummary(selectedSemesterRef.current))
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [])

    async function fetchSummary(semId?: string) {
        setLoading(true)
        try {
            const url = semId ? `/api/cache/admin-summary?semesterId=${encodeURIComponent(semId)}` : '/api/cache/admin-summary'
            const response = await fetch(url, { cache: 'no-store' })
            if (!response.ok) return

            const payload = await response.json()
            const adminData = payload.data || {}

            setStats(adminData.stats || {
                totalStudents: 0,
                selectedSemesterId: '',
                selectedSemesterName: 'None',
                isSelectedSemesterActive: false,
                isSelectedSemesterLocked: false,
                sectionsCount: 0,
                crCount: 0,
                pendingApps: 0,
            })
            if (adminData.stats?.selectedSemesterId && !semId) {
                setSelectedSemesterId(adminData.stats.selectedSemesterId)
            }
            setAuditLogs(adminData.auditLogs || [])
            setAdvisorProgress(adminData.advisorProgress || [])
            setSemesterHistory(adminData.semesterHistory || [])
        } finally {
            setLoading(false)
        }
    }

    function handleSemesterChange(semId: string) {
        setSelectedSemesterId(semId)
        fetchSummary(semId)
    }

    function exportAuditCSV() {
        const rows = auditLogs.map(l => [l.action, l.note, new Date(l.timestamp).toLocaleString()])
        const csv = [['Action', 'Details', 'Time'], ...rows].map(r => r.join(',')).join('\n')
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
        a.download = 'audit_log.csv'; a.click()
    }

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            {/* Header with Semester Switcher */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                            Administration
                        </span>
                        <Badge variant="outline" className="text-xs font-mono">
                            {stats.selectedSemesterName}
                        </Badge>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Console</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Live analytics, section configuration, and system oversight.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Semester Switcher Dropdown */}
                    <div className="flex items-center gap-1.5 bg-muted/40 border-2 border-border rounded-xl p-1 px-2.5 shadow-xs">
                        <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase hidden sm:inline">Semester:</span>
                        <Select value={selectedSemesterId} onValueChange={handleSemesterChange}>
                            <SelectTrigger className="h-7 min-w-[150px] text-xs font-medium bg-background border border-border">
                                <SelectValue placeholder="Semester..." />
                            </SelectTrigger>
                            <SelectContent>
                                {semesterHistory.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs">
                                        {s.name} {s.is_active ? '• (Active)' : '(Archived)'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Badge
                            variant={stats.isSelectedSemesterActive ? 'default' : 'outline'}
                            className={`text-[10px] ${stats.isSelectedSemesterActive ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}
                        >
                            {stats.isSelectedSemesterActive ? 'Live' : 'Archived'}
                        </Badge>
                    </div>

                    {stats.pendingApps > 0 && (
                        <Link 
                            href="/admin/users" 
                            className="flex items-center gap-1.5 bg-destructive/10 border-2 border-destructive/30 text-destructive text-xs font-semibold px-3 py-1.5 rounded-xl animate-pulse shadow-xs"
                        >
                            <Bell className="h-3.5 w-3.5" /> {stats.pendingApps} Pending CR App{stats.pendingApps > 1 ? 's' : ''}
                        </Link>
                    )}
                </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-bold">Registrations</span>
                        <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{stats.totalStudents}</div>
                        <p className="text-[11px] text-muted-foreground font-semibold mt-0.5 truncate">In {stats.selectedSemesterName}</p>
                    </div>
                </div>

                <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-bold">Sections</span>
                        <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{stats.sectionsCount}</div>
                        <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">Active cohort groups</p>
                    </div>
                </div>

                <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-bold">Active CRs</span>
                        <ShieldAlert className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{stats.crCount}</div>
                        <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">Authorized representatives</p>
                    </div>
                </div>

                <div className={`border-2 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between ${
                    stats.pendingApps > 0 ? 'border-destructive/40 bg-destructive/5' : 'bg-card border-border hover:border-primary/40 transition-colors'
                }`}>
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-bold">Pending Apps</span>
                        <Bell className={`h-4 w-4 ${stats.pendingApps > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="mt-3">
                        <div className={`text-2xl sm:text-3xl font-extrabold ${stats.pendingApps > 0 ? 'text-destructive' : 'text-foreground'}`}>
                            {stats.pendingApps}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">Awaiting staff review</p>
                    </div>
                </div>
            </div>

            {/* 3-Column Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Advisor Progress */}
                <div className="bg-card border-2 border-border rounded-2xl shadow-xs overflow-hidden flex flex-col">
                    <div className="p-4 sm:p-5 border-b-2 border-border bg-muted/20">
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" /> Advising Completion
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium">Progress by faculty advisor for {stats.selectedSemesterName}.</p>
                    </div>
                    <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto max-h-[460px]">
                        {advisorProgress.length === 0 && (
                            <p className="text-xs text-muted-foreground italic text-center py-8">No advisors found for this semester.</p>
                        )}
                        {advisorProgress.map(a => (
                            <div key={a.id || a.name} className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="font-semibold text-foreground truncate">{a.name}</span>
                                    <span className="text-muted-foreground shrink-0 ml-2 font-mono text-[11px] font-bold">{a.done}/{a.total}</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            a.pct === 100 ? 'bg-emerald-500' : a.pct >= 50 ? 'bg-primary' : 'bg-amber-500'
                                        }`}
                                        style={{ width: `${a.pct}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                                    <span>{a.pct}% advised</span>
                                    <span>{a.total - a.done} remaining</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Audit Log Stream */}
                <div className="bg-card border-2 border-border rounded-2xl shadow-xs overflow-hidden flex flex-col">
                    <div className="p-4 sm:p-5 border-b-2 border-border bg-muted/20 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-sm text-foreground">Recent Audit Events</h3>
                            <p className="text-xs text-muted-foreground font-medium">Chronological log ({auditLogs.length} entries)</p>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 font-semibold" onClick={exportAuditCSV}>
                            <Download className="h-3 w-3" /> CSV
                        </Button>
                    </div>
                    <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto max-h-[460px] divide-y divide-border/60">
                        {auditLogs.length === 0 && (
                            <p className="text-xs text-muted-foreground italic text-center py-8">No recent activity.</p>
                        )}
                        {auditLogs.map(log => (
                            <div key={log.id} className="pt-3 first:pt-0 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge 
                                        variant="outline" 
                                        className={`text-[9px] font-bold ${
                                            log.action === 'DELETE' 
                                                ? 'border-destructive/40 text-destructive bg-destructive/10' 
                                                : log.action === 'EDIT' 
                                                ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10' 
                                                : 'border-primary/40 text-primary bg-primary/10'
                                        }`}
                                    >
                                        {log.action}
                                    </Badge>
                                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                                        {log.role || 'user'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                                    {log.note}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Management Navigation */}
                <div className="bg-card border-2 border-border rounded-2xl shadow-xs overflow-hidden flex flex-col">
                    <div className="p-4 sm:p-5 border-b-2 border-border bg-muted/20">
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                            <Settings className="h-4 w-4 text-muted-foreground" /> Management Links
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium">Admin tools and sub-modules.</p>
                    </div>
                    <div className="p-4 sm:p-5 space-y-2 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                            <Button variant="ghost" className="w-full justify-between text-xs h-9 hover:bg-muted/50" asChild>
                                <Link href="/admin/users" className="flex items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>Users &amp; CR Approvals</span>
                                    </div>
                                    {stats.pendingApps > 0 ? (
                                        <Badge className="bg-destructive text-destructive-foreground text-[10px]">{stats.pendingApps}</Badge>
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    )}
                                </Link>
                            </Button>
                            <Button variant="ghost" className="w-full justify-between text-xs h-9 hover:bg-muted/50" asChild>
                                <Link href="/admin/advisors" className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>Manage Advisors</span>
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                                </Link>
                            </Button>
                            <Button variant="ghost" className="w-full justify-between text-xs h-9 hover:bg-muted/50" asChild>
                                <Link href="/admin/eligible-students" className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>Eligible Students Directory</span>
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                                </Link>
                            </Button>
                            <Button variant="ghost" className="w-full justify-between text-xs h-9 hover:bg-muted/50" asChild>
                                <Link href="/admin/courses" className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>Offered Courses Catalog</span>
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                                </Link>
                            </Button>
                            <Button variant="ghost" className="w-full justify-between text-xs h-9 hover:bg-muted/50" asChild>
                                <Link href="/admin/semesters" className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>Manage Semesters</span>
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                                </Link>
                            </Button>
                            <Button variant="ghost" className="w-full justify-between text-xs h-9 hover:bg-muted/50" asChild>
                                <Link href="/admin/sections" className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>Manage Sections &amp; Labs</span>
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                                </Link>
                            </Button>
                        </div>

                        {/* Interactive Semester History List */}
                        <div className="pt-3 border-t border-border/60">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Quick Semester Filter
                            </p>
                            <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                                {semesterHistory.map(s => {
                                    const isSelected = s.id === selectedSemesterId
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => handleSemesterChange(s.id)}
                                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-all ${
                                                isSelected
                                                    ? 'bg-primary/10 font-semibold text-primary border border-primary/30'
                                                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <span className="truncate">{s.name}</span>
                                            <Badge variant={s.is_active ? 'default' : 'outline'} className="text-[9px] ml-2">
                                                {s.is_active ? 'Live' : 'Archived'}
                                            </Badge>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
