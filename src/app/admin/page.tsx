'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, ShieldAlert, Calendar, Settings, Bell, GraduationCap, Download, TrendingUp, BookOpen, Layers, RefreshCw } from 'lucide-react'
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
        <div className="container mx-auto p-6 space-y-8">
            {/* Header with Semester Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Admin Dashboard</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Live overview &amp; operational controls for student section pre-registration.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Semester Switcher Dropdown */}
                    <div className="flex items-center gap-2 bg-slate-50 border rounded-xl p-1.5 shadow-sm">
                        <Layers className="h-4 w-4 text-blue-600 ml-2" />
                        <span className="text-xs font-semibold text-slate-600 hidden sm:inline">Semester:</span>
                        <Select value={selectedSemesterId} onValueChange={handleSemesterChange}>
                            <SelectTrigger className="h-9 min-w-[170px] bg-white border-slate-200">
                                <SelectValue placeholder="Select Semester..." />
                            </SelectTrigger>
                            <SelectContent>
                                {semesterHistory.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name} {s.is_active ? '★ (Live Active)' : '(Archived)'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Badge
                            variant={stats.isSelectedSemesterActive ? 'default' : 'outline'}
                            className={stats.isSelectedSemesterActive ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-100 text-slate-700'}
                        >
                            {stats.isSelectedSemesterActive ? 'Live' : 'Archived'}
                        </Badge>
                    </div>

                    {stats.pendingApps > 0 && (
                        <Link href="/admin/users" className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-2 rounded-xl animate-pulse shadow-sm">
                            <Bell className="h-4 w-4" /> {stats.pendingApps} Pending CR App{stats.pendingApps > 1 ? 's' : ''}
                        </Link>
                    )}
                </div>
            </div>

            {/* Stats Cards (Filtered for the selected semester) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-slate-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Registrations ({stats.selectedSemesterName})
                        </CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{stats.totalStudents}</div>
                        <p className="text-xs text-muted-foreground mt-1">Students enrolled in {stats.selectedSemesterName}</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Sections ({stats.selectedSemesterName})</CardTitle>
                        <Calendar className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{stats.sectionsCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Sections created in this semester</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Active CRs</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{stats.crCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Authorized CR accounts</p>
                    </CardContent>
                </Card>

                <Card className={stats.pendingApps > 0 ? 'border-red-300 bg-red-50/70 shadow-sm' : 'border-slate-100 shadow-sm'}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Pending CR Apps</CardTitle>
                        <Bell className={`h-4 w-4 ${stats.pendingApps > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${stats.pendingApps > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.pendingApps}</div>
                        <p className="text-xs text-muted-foreground mt-1">Applications awaiting approval</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Advisor Progress (For selected semester) */}
                <Card className="md:col-span-1 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="h-4 w-4 text-blue-600" /> Advisor Completion ({stats.selectedSemesterName})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {advisorProgress.length === 0 && (
                            <p className="text-sm text-muted-foreground italic">No advisors found.</p>
                        )}
                        {advisorProgress.map(a => (
                            <div key={a.id || a.name} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium truncate">{a.name}</span>
                                    <span className="text-muted-foreground shrink-0 ml-2 font-mono text-xs">{a.done}/{a.total} advised</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${a.pct === 100 ? 'bg-green-500' : a.pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                                        style={{ width: `${a.pct}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[11px] text-muted-foreground">
                                    <span>{a.pct}% completed</span>
                                    <span>{a.total - a.done} remaining</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Audit Log */}
                <Card className="md:col-span-1 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Recent System Activity</CardTitle>
                            <Button size="sm" variant="ghost" onClick={exportAuditCSV}>
                                <Download className="h-3.5 w-3.5 mr-1" /> CSV
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {auditLogs.length === 0 && <p className="text-sm text-muted-foreground italic">No activity yet.</p>}
                        {auditLogs.map(log => (
                            <div key={log.id} className="border-b pb-2.5 last:border-0 last:pb-0">
                                <div className="flex items-center gap-2">
                                    <Badge variant={log.action === 'DELETE' ? 'destructive' : log.action === 'EDIT' ? 'secondary' : 'default'} className="text-[10px]">
                                        {log.action}
                                    </Badge>
                                    <span className="text-[11px] text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                                </div>
                                <p className="text-xs text-slate-700 mt-1">{log.note}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Quick Links + Semester History (Interactive Switcher) */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex gap-2 items-center text-base">
                            <Settings className="h-4 w-4 text-slate-600" /> Quick Management
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <Link href="/admin/users"><Bell className="h-4 w-4" /> Users &amp; CR Approvals {stats.pendingApps > 0 && <Badge className="ml-auto bg-red-500 text-white text-xs">{stats.pendingApps}</Badge>}</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <Link href="/admin/advisors"><GraduationCap className="h-4 w-4" /> Manage Advisors (All Semesters)</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <Link href="/admin/eligible-students"><Users className="h-4 w-4" /> Manage Eligible Students</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <Link href="/admin/courses"><BookOpen className="h-4 w-4 text-blue-600" /> Manage Offered Courses</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <Link href="/admin/semesters"><Calendar className="h-4 w-4" /> Manage Semesters</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <Link href="/admin/sections"><Settings className="h-4 w-4" /> Manage Sections</Link>
                        </Button>

                        {/* Interactive Semester History */}
                        <div className="pt-3 border-t mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    Semester History (Click to view)
                                </p>
                            </div>
                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                {semesterHistory.map(s => {
                                    const isSelected = s.id === selectedSemesterId
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => handleSemesterChange(s.id)}
                                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-sm transition-all ${
                                                isSelected
                                                    ? 'bg-blue-50 border border-blue-200 font-semibold text-blue-900 shadow-xs'
                                                    : 'hover:bg-slate-100 text-slate-700'
                                            }`}
                                        >
                                            <span className="truncate">{s.name}</span>
                                            <Badge variant={s.is_active ? 'default' : 'outline'} className={`text-[10px] ml-2 ${s.is_active ? 'bg-green-600 text-white' : ''}`}>
                                                {s.is_active ? 'Active' : 'Archived'}
                                            </Badge>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

