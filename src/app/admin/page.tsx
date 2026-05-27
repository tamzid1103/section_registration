'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { invalidateCacheScopes } from '@/lib/cache/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Users, ShieldAlert, Calendar, Settings, Bell, GraduationCap, Download, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
    const supabase = createClient()

    const [stats, setStats] = useState({ totalStudents: 0, activeSemester: 'None', sectionsCount: 0, crCount: 0, pendingApps: 0 })
    const [auditLogs, setAuditLogs] = useState<any[]>([])
    const [advisorProgress, setAdvisorProgress] = useState<any[]>([])
    const [semesterHistory, setSemesterHistory] = useState<any[]>([])

    useEffect(() => {
        fetchAll()
        const ch = supabase.channel('admin-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cr_applications' }, fetchAll)
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [])

    async function fetchAll() {
        const response = await fetch('/api/cache/admin-summary', { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json()
        const adminData = payload.data || {}

        setStats(adminData.stats || { totalStudents: 0, activeSemester: 'None', sectionsCount: 0, crCount: 0, pendingApps: 0 })
        setAuditLogs(adminData.auditLogs || [])
        setAdvisorProgress(adminData.advisorProgress || [])
        setSemesterHistory(adminData.semesterHistory || [])
    }

    function exportAuditCSV() {
        const rows = auditLogs.map(l => [l.action, l.note, new Date(l.timestamp).toLocaleString()])
        const csv = [['Action', 'Details', 'Time'], ...rows].map(r => r.join(',')).join('\n')
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
        a.download = 'audit_log.csv'; a.click()
    }

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Admin Dashboard</h1>
                    <Badge variant="secondary" className="mt-1 px-3 py-0.5">{stats.activeSemester}</Badge>
                </div>
                {stats.pendingApps > 0 && (
                    <Link href="/admin/users" className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-2 rounded-lg animate-pulse">
                        <Bell className="h-4 w-4" /> {stats.pendingApps} Pending CR Application{stats.pendingApps > 1 ? 's' : ''}
                    </Link>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-3xl font-bold">{stats.totalStudents}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active CRs</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-3xl font-bold">{stats.crCount}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Sections</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-3xl font-bold">{stats.sectionsCount}</div></CardContent>
                </Card>
                <Card className={stats.pendingApps > 0 ? 'border-red-300 bg-red-50' : ''}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Pending CR Apps</CardTitle>
                        <Bell className={`h-4 w-4 ${stats.pendingApps > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${stats.pendingApps > 0 ? 'text-red-600' : ''}`}>{stats.pendingApps}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Advisor Progress */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="h-4 w-4 text-blue-500" /> Advisor Completion
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {advisorProgress.length === 0 && (
                            <p className="text-sm text-muted-foreground italic">No advisors yet.</p>
                        )}
                        {advisorProgress.map(a => (
                            <div key={a.name} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium truncate">{a.name}</span>
                                    <span className="text-muted-foreground shrink-0 ml-2">{a.done}/{a.total}</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${a.pct === 100 ? 'bg-green-500' : a.pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                                        style={{ width: `${a.pct}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">{a.pct}% advised</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Audit Log */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Recent Activity</CardTitle>
                            <Button size="sm" variant="ghost" onClick={exportAuditCSV}>
                                <Download className="h-3.5 w-3.5 mr-1" /> CSV
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {auditLogs.length === 0 && <p className="text-sm text-muted-foreground italic">No activity yet.</p>}
                        {auditLogs.map(log => (
                            <div key={log.id} className="border-b pb-2 last:border-0 last:pb-0">
                                <div className="flex items-center gap-2">
                                    <Badge variant={log.action === 'DELETE' ? 'destructive' : log.action === 'EDIT' ? 'secondary' : 'default'} className="text-[10px]">
                                        {log.action}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                                </div>
                                <p className="text-xs text-slate-700 mt-1">{log.note}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Quick Links + Semester History */}
                <Card>
                    <CardHeader><CardTitle className="flex gap-2 items-center text-base"><Settings className="h-4 w-4" /> Quick Links</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <Link href="/admin/users"><Bell className="h-4 w-4" /> Users & CR Approvals {stats.pendingApps > 0 && <Badge className="ml-auto bg-red-500 text-white text-xs">{stats.pendingApps}</Badge>}</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <Link href="/admin/advisors"><GraduationCap className="h-4 w-4" /> Manage Advisors</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <Link href="/admin/semesters"><Calendar className="h-4 w-4" /> Manage Semesters</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <Link href="/admin/sections"><Settings className="h-4 w-4" /> Manage Sections</Link>
                        </Button>
                        <div className="pt-2 border-t">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-widest">Semester History</p>
                            {semesterHistory.map(s => (
                                <div key={s.id} className="flex items-center justify-between py-1">
                                    <span className="text-sm">{s.name}</span>
                                    <Badge variant={s.is_active ? 'default' : 'outline'} className="text-xs">
                                        {s.is_active ? 'Active' : 'Archived'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
