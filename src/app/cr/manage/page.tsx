'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, UserPlus, History, Shield, LogOut, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function CRManagePage() {
    const [activeSemester, setActiveSemester] = useState<any>(null)
    const [sections, setSections] = useState<any[]>([])
    const [logs, setLogs] = useState<any[]>([])
    const [crInfo, setCrInfo] = useState<any>(null)
    const [sectionsWithCounts, setSectionsWithCounts] = useState<any[]>([])

    const [studentName, setStudentName] = useState('')
    const [studentId, setStudentId] = useState('')
    const [selectedSection, setSelectedSection] = useState('')
    const [note, setNote] = useState('')

    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        fetchInitialData()
        const channel = supabase.channel('cr-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
                fetchLogs()
                fetchSectionCounts()
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchInitialData() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
            const { data: staff } = await supabase
                .from('authorized_staff')
                .select('*')
                .eq('email', user.email)
                .single()
            setCrInfo(staff)
        }

        const { data: semester } = await supabase
            .from('semesters')
            .select('*')
            .eq('is_active', true)
            .single()
        setActiveSemester(semester)

        if (semester) {
            const { data: sData } = await supabase
                .from('sections')
                .select('*')
                .eq('semester_id', semester.id)
                .order('name')
            setSections(sData || [])
            fetchLogs()
            fetchSectionCounts(sData || [])
        }
    }

    async function fetchSectionCounts(sData?: any[]) {
        const secList = sData || sections
        if (!secList.length) return
        const { data: regs } = await supabase.from('registrations').select('section_id')
        const withCounts = secList.map(s => ({
            ...s,
            current: regs?.filter(r => r.section_id === s.id).length || 0
        }))
        setSectionsWithCounts(withCounts)
    }

    async function fetchLogs() {
        const { data } = await supabase
            .from('cr_registration_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(25)
        if (data) setLogs(data)
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        if (!activeSemester || !crInfo) {
            toast.error('No active semester or you are not authorized.')
            return
        }
        if (!note.trim()) {
            toast.error('A note/reason is required for each registration.')
            return
        }

        // Look up advisor for this student ID
        let advisorId: string | null = null
        const numericId = studentId.replace(/-/g, '')
        const { data: ranges } = await supabase
            .from('student_advisor_ranges')
            .select('advisor_id, start_id_numeric, end_id_numeric')
            .eq('semester_id', activeSemester.id)

        if (ranges) {
            const match = ranges.find(r =>
                Number(numericId) >= Number(r.start_id_numeric) &&
                Number(numericId) <= Number(r.end_id_numeric)
            )
            advisorId = match?.advisor_id || null
        }

        const { error } = await supabase.from('registrations').insert({
            student_name: studentName,
            student_id: studentId,
            section_id: selectedSection,
            advisor_id: advisorId,
            entered_by: crInfo.id,
            note: note.trim(),
        })

        if (error) {
            toast.error(error.code === '23505'
                ? 'This Student ID is already registered. Cannot register in two sections.'
                : error.message
            )
        } else {
            toast.success('Student registered successfully!')
            setStudentName('')
            setStudentId('')
            setSelectedSection('')
            setNote('')
            fetchLogs()
            fetchSectionCounts()
        }
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/auth/login')
    }

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">CR Management Portal</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Logged in as: <span className="font-semibold text-primary">{crInfo?.email}</span>
                        {crInfo?.role === 'admin' && <Badge className="ml-2">Admin</Badge>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className={activeSemester ? "border-green-500 text-green-600" : "border-destructive text-destructive"}>
                        {activeSemester ? `Active: ${activeSemester.name}` : 'Registration Closed'}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                        <LogOut className="h-4 w-4" /> Logout
                    </Button>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Registration Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5" /> New Student Registration
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Student Name</label>
                                <Input
                                    value={studentName}
                                    onChange={e => setStudentName(e.target.value)}
                                    placeholder="Full Name"
                                    required
                                    disabled={!activeSemester}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Student ID</label>
                                <Input
                                    value={studentId}
                                    onChange={e => setStudentId(e.target.value)}
                                    placeholder="241-15-877"
                                    required
                                    disabled={!activeSemester}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Section</label>
                                <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!activeSemester}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sectionsWithCounts.map(s => (
                                            <SelectItem
                                                key={s.id}
                                                value={s.id}
                                                disabled={s.current >= s.capacity}
                                            >
                                                {s.name} ({s.current}/{s.capacity} seats)
                                                {s.current >= s.capacity ? ' — FULL' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Note / Reason <span className="text-red-500">*</span></label>
                                <Textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    placeholder="e.g. Student confirmed section preference in person."
                                    required
                                    disabled={!activeSemester}
                                    rows={2}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={!activeSemester || !selectedSection}>
                                <Plus className="h-4 w-4 mr-2" /> Register Student
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Live Logs */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" /> Registration Logs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border overflow-auto max-h-96">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student</TableHead>
                                        <TableHead>Section</TableHead>
                                        <TableHead>Done</TableHead>
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
                                                {log.advisor_completed
                                                    ? <CheckCircle className="h-4 w-4 text-green-500" />
                                                    : <span className="text-xs text-muted-foreground">—</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {logs.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                No registrations yet
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
