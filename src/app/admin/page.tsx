'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, ShieldAlert, Users, Calendar, LogOut, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeSemester: 'None',
        sectionsCount: 0,
        crCount: 0
    })
    const [recentLogs, setRecentLogs] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        fetchStats()
        fetchLogs()
    }, [])

    async function fetchStats() {
        const { data: semester } = await supabase.from('semesters').select('id, name').eq('is_active', true).single()
        const { count: students } = await supabase.from('registrations').select('*', { count: 'exact', head: true })
        const { count: crs } = await supabase.from('authorized_staff').select('*', { count: 'exact', head: true }).eq('role', 'cr')
        const { count: sections } = await supabase.from('sections').select('*', { count: 'exact', head: true }).eq('semester_id', semester?.id || '')

        setStats({
            totalStudents: students || 0,
            activeSemester: semester?.name || 'In-between Semesters',
            sectionsCount: sections || 0,
            crCount: crs || 0
        })
    }

    async function fetchLogs() {
        const { data } = await supabase
            .from('cr_registration_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)
        if (data) setRecentLogs(data)
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/auth/login')
    }

    const filtered = recentLogs.filter(l =>
        (l.student_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.student_id || '').includes(search)
    )

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Admin Dashboard</h1>
                    <Badge variant="secondary" className="mt-1 px-3 py-0.5">{stats.activeSemester}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                    <LogOut className="h-4 w-4" /> Logout
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.totalStudents}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active CRs</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.crCount}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Sections</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.sectionsCount}</div></CardContent>
                </Card>
                <Card className="bg-primary text-primary-foreground">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">System Health</CardTitle>
                        <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">Operational</div></CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Recent Registration Activity</CardTitle>
                            <div className="relative w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search students..."
                                    className="pl-8"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead>CR</TableHead>
                                    <TableHead>Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            <div className="font-semibold">{log.student_name}</div>
                                            <div className="text-xs text-muted-foreground">{log.student_id}</div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{log.section_name}</Badge></TableCell>
                                        <TableCell>
                                            <div className="text-sm font-medium">{log.cr_name}</div>
                                            <div className="text-[10px] text-muted-foreground">{log.cr_email}</div>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {new Date(log.created_at).toLocaleTimeString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filtered.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">
                                            No recent activity
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="flex gap-2 items-center"><Settings className="h-4 w-4" /> Quick Links</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/admin/users">Manage Users & CR Approvals</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/admin/advisors">Manage Advisors</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/admin/semesters">Manage Semesters</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/admin/sections">Manage Sections</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
