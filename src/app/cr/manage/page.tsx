'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, UserPlus, History, Shield } from 'lucide-react'
import { toast } from 'sonner'

export default function CRManagePage() {
    const [activeSemester, setActiveSemester] = useState<any>(null)
    const [sections, setSections] = useState<any[]>([])
    const [logs, setLogs] = useState<any[]>([])
    const [crInfo, setCrInfo] = useState<any>(null)

    // Registration Form State
    const [studentName, setStudentName] = useState('')
    const [studentId, setStudentId] = useState('')
    const [selectedSection, setSelectedSection] = useState('')

    const supabase = createClient()

    useEffect(() => {
        fetchInitialData()

        // Real-time subscription
        const channel = supabase.channel('cr-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
                fetchLogs()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchInitialData() {
        // 1. Get Me
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
            const { data: staff } = await supabase.from('authorized_staff').select('*').eq('email', user.email).single()
            setCrInfo(staff)
        }

        // 2. Get Active Semester
        const { data: semester } = await supabase.from('semesters').select('*').eq('is_active', true).single()
        setActiveSemester(semester)

        // 3. Get Sections
        if (semester) {
            const { data: sectionsData } = await supabase.from('sections').select('*').eq('semester_id', semester.id)
            setSections(sectionsData || [])
            fetchLogs()
        }
    }

    async function fetchLogs() {
        const { data } = await supabase.from('cr_registration_logs').select('*').order('created_at', { ascending: false }).limit(20)
        if (data) setLogs(data)
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        if (!activeSemester || !crInfo) {
            toast.error("No active semester or unauthorized")
            return
        }

        const { error } = await supabase.from('registrations').insert({
            student_name: studentName,
            student_id: studentId,
            section_id: selectedSection,
            semester_id: activeSemester.id,
            created_by_cr_id: crInfo.id
        })

        if (error) {
            toast.error(error.message)
        } else {
            toast.success("Student registered successfully")
            setStudentName('')
            setStudentId('')
            setSelectedSection('')
            fetchLogs()
        }
    }

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">CR Management Portal</h1>
                    <p className="text-muted-foreground">
                        Logged in as: <span className="font-semibold text-primary">{crInfo?.email}</span>
                        {crInfo?.role === 'admin' && <Badge className="ml-2">Admin</Badge>}
                    </p>
                </div>
                <div className="text-right">
                    <Badge variant="outline" className={activeSemester ? "border-green-500 text-green-500" : "border-destructive text-destructive"}>
                        {activeSemester ? `Active: ${activeSemester.name}` : "Registration Closed"}
                    </Badge>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Registration Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5" /> New Registration
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Student Name</label>
                                <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Full Name" required disabled={!activeSemester} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Student ID</label>
                                <Input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="e.g. 241-15-XXX" required disabled={!activeSemester} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Section</label>
                                <Select value={selectedSection} onValueChange={setSelectedSection} required disabled={!activeSemester}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name} ({s.current_seats}/{s.max_seats})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" className="w-full" disabled={!activeSemester}>
                                Register Student
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Real-time Internal Logs */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" /> Internal Registration Logs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student</TableHead>
                                        <TableHead>Section</TableHead>
                                        <TableHead>Entered By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="py-2">
                                                <div className="font-medium text-xs">{log.student_name}</div>
                                                <div className="text-[10px] text-muted-foreground">{log.student_id}</div>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Badge variant="outline">{log.section_name}</Badge>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <div className="flex items-center gap-1 text-[10px]">
                                                    <Shield className="h-3 w-3 text-primary" />
                                                    {log.cr_email.split('@')[0]}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {logs.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                No recent activity
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
