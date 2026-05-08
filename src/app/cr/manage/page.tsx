'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
    Plus, Trash2, Pencil, CheckCircle2, Circle, Download, Upload,
    Users, BookOpen, Clock, LogOut
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function CRManagePage() {
    const supabase = createClient()
    const router = useRouter()

    // ── State ───────────────────────────────────────────────────────────────
    const [crInfo, setCrInfo] = useState<any>(null)
    const [semester, setSemester] = useState<any>(null)
    const [sections, setSections] = useState<any[]>([])
    const [labGroups, setLabGroups] = useState<any[]>([])
    const [registrations, setRegistrations] = useState<any[]>([])
    const [advisors, setAdvisors] = useState<any[]>([])
    const [auditLogs, setAuditLogs] = useState<any[]>([])

    // Form state
    const [fName, setFName] = useState('')
    const [fId, setFId] = useState('')
    const [fSection, setFSection] = useState('')
    const [fLab, setFLab] = useState('')
    const [fNote, setFNote] = useState('')

    // Edit dialog
    const [editReg, setEditReg] = useState<any>(null)
    const [editSection, setEditSection] = useState('')
    const [editLab, setEditLab] = useState('')
    const [editLabGroups, setEditLabGroups] = useState<any[]>([])
    const [editNote, setEditNote] = useState('')

    // Search
    const [search, setSearch] = useState('')
    const csvRef = useRef<HTMLInputElement>(null)

    // ── Init ────────────────────────────────────────────────────────────────
    useEffect(() => {
        init()
        const ch = supabase.channel('cr-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => fetchRegistrations())
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [])

    async function init() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: staff } = await supabase.from('authorized_staff').select('*').eq('email', user.email).single()
        setCrInfo(staff)

        const { data: sem } = await supabase.from('semesters').select('*').eq('is_active', true).single()
        setSemester(sem)

        if (sem) {
            const { data: secs } = await supabase.from('sections').select('*').eq('semester_id', sem.id).order('name')
            setSections(secs || [])
        }

        const { data: advs } = await supabase.from('advisors').select('*, student_advisor_ranges(start_id, end_id, semesters(name))').order('name')
        setAdvisors(advs || [])

        await fetchRegistrations()
        await fetchAuditLogs()
    }

    async function fetchRegistrations() {
        const { data } = await supabase
            .from('registrations')
            .select('*, sections(name, semester_id), lab_groups(name), advisors(name), authorized_staff(name, email)')
            .order('timestamp', { ascending: false })
        if (data) setRegistrations(data)
    }

    async function fetchAuditLogs() {
        const { data } = await supabase
            .from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(30)
        if (data) setAuditLogs(data)
    }

    async function loadLabGroups(sectionId: string) {
        const { data } = await supabase.from('lab_groups').select('*').eq('section_id', sectionId).order('name')
        setLabGroups(data || [])
        setFLab('')
    }

    // ── Register Student ─────────────────────────────────────────────────────
    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        if (!fName || !fId || !fSection) { toast.error('Name, ID, and Section are required.'); return }
        if (!crInfo || !semester) { toast.error('No active semester or not authorized.'); return }

        // Auto-lookup advisor
        const numId = parseInt(fId.replace(/-/g, ''))
        let advisorId: string | null = null
        const { data: ranges } = await supabase.from('student_advisor_ranges')
            .select('advisor_id, start_id_numeric, end_id_numeric').eq('semester_id', semester.id)
        if (ranges) {
            const match = ranges.find(r => numId >= Number(r.start_id_numeric) && numId <= Number(r.end_id_numeric))
            advisorId = match?.advisor_id || null
        }

        const { error } = await supabase.from('registrations').insert({
            student_name: fName.trim(),
            student_id: fId.trim(),
            section_id: fSection,
            lab_group_id: fLab || null,
            advisor_id: advisorId,
            entered_by: crInfo.id,
            note: fNote.trim(),
        })

        if (error) {
            toast.error(error.message.includes('full') ? error.message :
                error.message.includes('duplicate') || error.message.includes('unique') ?
                    `Student ID ${fId} is already registered.` : error.message)
            return
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            role: crInfo.role, action: 'ADD',
            note: `Added ${fName} (${fId}) to section ${sections.find(s => s.id === fSection)?.name}`
        })

        toast.success('Student registered!')
        setFName(''); setFId(''); setFSection(''); setFLab(''); setFNote('')
        setLabGroups([])
        fetchRegistrations()
    }

    // ── Delete Student ───────────────────────────────────────────────────────
    async function handleDelete(reg: any) {
        if (!confirm(`Delete ${reg.student_name} (${reg.student_id}) from section ${reg.sections?.name}?`)) return

        const { error } = await supabase.from('registrations').delete().eq('id', reg.id)
        if (error) { toast.error(error.message); return }

        await supabase.from('audit_logs').insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            role: crInfo?.role || 'cr', action: 'DELETE',
            note: `Deleted ${reg.student_name} (${reg.student_id}) from section ${reg.sections?.name}`
        })
        toast.success('Student entry deleted.')
        fetchRegistrations(); fetchAuditLogs()
    }

    // ── Edit Student ─────────────────────────────────────────────────────────
    async function openEdit(reg: any) {
        setEditReg(reg)
        setEditSection(reg.section_id)
        setEditNote(reg.note || '')
        const { data: lgs } = await supabase.from('lab_groups').select('*').eq('section_id', reg.section_id).order('name')
        setEditLabGroups(lgs || [])
        setEditLab(reg.lab_group_id || '')
    }

    async function onEditSectionChange(secId: string) {
        setEditSection(secId)
        setEditLab('')
        const { data: lgs } = await supabase.from('lab_groups').select('*').eq('section_id', secId).order('name')
        setEditLabGroups(lgs || [])
    }

    async function handleEditSave() {
        if (!editReg) return
        const { error } = await supabase.from('registrations').update({
            section_id: editSection, lab_group_id: editLab || null, note: editNote.trim()
        }).eq('id', editReg.id)

        if (error) { toast.error(error.message); return }

        await supabase.from('audit_logs').insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            role: crInfo?.role || 'cr', action: 'EDIT',
            note: `Edited ${editReg.student_name} (${editReg.student_id}) — moved to section ${sections.find(s => s.id === editSection)?.name}`
        })

        toast.success('Student updated.')
        setEditReg(null)
        fetchRegistrations(); fetchAuditLogs()
    }

    // ── CSV Import ───────────────────────────────────────────────────────────
    async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !semester || !crInfo) return
        const text = await file.text()
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
        const header = lines[0].toLowerCase()
        if (!header.includes('student_id') && !header.includes('id')) {
            toast.error('CSV must have columns: student_id, student_name, section_name, lab_group_name (optional), note (optional)')
            return
        }
        const rows = lines.slice(1)
        let success = 0, fail = 0

        // Get ranges for advisor lookup
        const { data: ranges } = await supabase.from('student_advisor_ranges')
            .select('advisor_id, start_id_numeric, end_id_numeric').eq('semester_id', semester.id)

        for (const row of rows) {
            const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
            const [studentId, studentName, sectionName, labGroupName, note] = cols
            if (!studentId || !studentName || !sectionName) { fail++; continue }

            const sec = sections.find(s => s.name.toLowerCase() === sectionName.toLowerCase())
            if (!sec) { fail++; continue }

            const { data: lgs } = await supabase.from('lab_groups').select('*').eq('section_id', sec.id).order('name')
            const lg = lgs?.find(l => l.name.toLowerCase() === (labGroupName || '').toLowerCase())

            const numId = parseInt(studentId.replace(/-/g, ''))
            const match = (ranges || []).find(r => numId >= Number(r.start_id_numeric) && numId <= Number(r.end_id_numeric))

            const { error } = await supabase.from('registrations').insert({
                student_id: studentId, student_name: studentName,
                section_id: sec.id, lab_group_id: lg?.id || null,
                advisor_id: match?.advisor_id || null,
                entered_by: crInfo.id, note: note || ''
            })
            if (error) fail++; else success++
        }

        toast.success(`Import done: ${success} added, ${fail} failed.`)
        if (csvRef.current) csvRef.current.value = ''
        fetchRegistrations()
    }

    // ── CSV Export ───────────────────────────────────────────────────────────
    function exportCSV() {
        const headers = ['Student ID', 'Student Name', 'Section', 'Lab Group', 'Advisor', 'Completed', 'Registered At']
        const rows = registrations.map(r => [
            r.student_id, r.student_name, r.sections?.name || '', r.lab_groups?.name || '',
            r.advisors?.name || '', r.advisor_completed ? 'Yes' : 'No',
            new Date(r.timestamp).toLocaleString()
        ])
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
        a.download = `registrations_${semester?.name || 'export'}.csv`; a.click()
    }

    // ── Print PDF ─────────────────────────────────────────────────────────────
    function printPDF() {
        const printContent = document.getElementById('print-area')?.innerHTML
        const win = window.open('', '_blank')
        if (!win || !printContent) return
        win.document.write(`<html><head><title>Registrations - ${semester?.name}</title>
        <style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ccc;padding:6px 10px;font-size:12px}th{background:#f0f0f0}
        </style></head><body>${printContent}</body></html>`)
        win.document.close(); win.print()
    }

    const filtered = registrations.filter(r =>
        r.student_id?.toLowerCase().includes(search.toLowerCase()) ||
        r.student_name?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">CR Management Portal</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Logged in as: <span className="font-semibold">{crInfo?.name || crInfo?.email}</span>
                        <Badge className="ml-2 text-xs">{crInfo?.role}</Badge>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={semester ? 'default' : 'destructive'} className="py-1 px-3">
                        {semester ? `📅 ${semester.name}` : 'No Active Semester'}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login') }}>
                        <LogOut className="h-4 w-4 mr-1" /> Logout
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="register">
                <TabsList className="grid grid-cols-4 w-full max-w-xl">
                    <TabsTrigger value="register"><Plus className="h-3.5 w-3.5 mr-1" /> Register</TabsTrigger>
                    <TabsTrigger value="students"><Users className="h-3.5 w-3.5 mr-1" /> Students ({registrations.length})</TabsTrigger>
                    <TabsTrigger value="advisors"><BookOpen className="h-3.5 w-3.5 mr-1" /> Advisors</TabsTrigger>
                    <TabsTrigger value="history"><Clock className="h-3.5 w-3.5 mr-1" /> History</TabsTrigger>
                </TabsList>

                {/* ── REGISTER TAB ─────────────────────────────────────────── */}
                <TabsContent value="register">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Add Student</CardTitle>
                                <CardDescription>Register a student to a section and lab group.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleRegister} className="space-y-3">
                                    <Input placeholder="Full Name *" value={fName} onChange={e => setFName(e.target.value)} required />
                                    <Input placeholder="Student ID (e.g. 241-15-877) *" value={fId} onChange={e => setFId(e.target.value)} required />
                                    <Select value={fSection} onValueChange={v => { setFSection(v); loadLabGroups(v) }}>
                                        <SelectTrigger><SelectValue placeholder="Select Section *" /></SelectTrigger>
                                        <SelectContent>
                                            {sections.map(s => {
                                                const cnt = registrations.filter(r => r.section_id === s.id).length
                                                return (
                                                    <SelectItem key={s.id} value={s.id} disabled={cnt >= s.capacity}>
                                                        {s.name} ({cnt}/{s.capacity}){cnt >= s.capacity ? ' — FULL' : ''}
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                    {labGroups.length > 0 && (
                                        <Select value={fLab} onValueChange={setFLab}>
                                            <SelectTrigger><SelectValue placeholder="Select Lab Group" /></SelectTrigger>
                                            <SelectContent>
                                                {labGroups.map(lg => {
                                                    const cnt = registrations.filter(r => r.lab_group_id === lg.id).length
                                                    return (
                                                        <SelectItem key={lg.id} value={lg.id} disabled={cnt >= lg.capacity}>
                                                            {lg.name} ({cnt}/{lg.capacity}){cnt >= lg.capacity ? ' — FULL' : ''}
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <Textarea placeholder="Note (Optional)" value={fNote} onChange={e => setFNote(e.target.value)} rows={2} />
                                    <Button type="submit" className="w-full" disabled={!semester}>
                                        <Plus className="h-4 w-4 mr-2" /> Register Student
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Bulk CSV Import */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Bulk Import (CSV)</CardTitle>
                                <CardDescription>
                                    CSV columns: <code className="text-xs bg-slate-100 px-1 rounded">student_id, student_name, section_name, lab_group_name, note</code>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                                    <p className="text-sm text-muted-foreground mb-3">Upload a CSV file to bulk-register students</p>
                                    <input type="file" accept=".csv" ref={csvRef} onChange={handleCSVImport} className="hidden" />
                                    <Button variant="outline" onClick={() => csvRef.current?.click()}>Choose CSV File</Button>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1 gap-2" onClick={exportCSV}>
                                        <Download className="w-4 h-4" /> Export CSV
                                    </Button>
                                    <Button variant="outline" className="flex-1 gap-2" onClick={printPDF}>
                                        <Download className="w-4 h-4" /> Print / PDF
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ── STUDENTS TAB ─────────────────────────────────────────── */}
                <TabsContent value="students">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>All Registered Students</CardTitle>
                                <Input placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Printable area */}
                            <div id="print-area">
                                <h2 style={{ display: 'none' }} className="print:block font-bold text-lg mb-4">
                                    {semester?.name} — Registration List
                                </h2>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student ID</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Section</TableHead>
                                            <TableHead>Lab Group</TableHead>
                                            <TableHead>Advisor</TableHead>
                                            <TableHead>Done</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map(r => (
                                            <TableRow key={r.id} className={r.advisor_completed ? 'bg-green-50' : ''}>
                                                <TableCell className="font-mono text-sm">{r.student_id}</TableCell>
                                                <TableCell className="font-medium">{r.student_name}</TableCell>
                                                <TableCell><Badge variant="outline">{r.sections?.name}</Badge></TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{r.lab_groups?.name || '—'}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{r.advisors?.name || '—'}</TableCell>
                                                <TableCell>
                                                    {r.advisor_completed
                                                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                        : <Circle className="h-4 w-4 text-slate-300" />}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(r)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filtered.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground italic">
                                                    {search ? 'No results found.' : 'No students registered yet.'}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── ADVISORS TAB ─────────────────────────────────────────── */}
                <TabsContent value="advisors">
                    <Card>
                        <CardHeader><CardTitle>Advisor List</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Student ID Ranges</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {advisors.map(a => (
                                        <TableRow key={a.id}>
                                            <TableCell className="font-semibold">{a.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{a.email}</TableCell>
                                            <TableCell className="text-sm">{a.phone || '—'}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {(a.student_advisor_ranges || []).map((r: any, i: number) => (
                                                        <Badge key={i} variant="outline" className="text-xs">
                                                            {r.start_id} – {r.end_id}
                                                            {r.semesters?.name ? ` (${r.semesters.name})` : ''}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {advisors.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">No advisors added yet.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── HISTORY TAB ──────────────────────────────────────────── */}
                <TabsContent value="history">
                    <Card>
                        <CardHeader><CardTitle>Audit Trail (Last 30 Actions)</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead>Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {auditLogs.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell>
                                                <Badge variant={log.action === 'DELETE' ? 'destructive' : log.action === 'EDIT' ? 'secondary' : 'default'}>
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">{log.note}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {auditLogs.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">No history yet.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit Dialog */}
            <Dialog open={!!editReg} onOpenChange={v => !v && setEditReg(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Student Entry</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm font-medium">{editReg?.student_name} — <span className="font-mono">{editReg?.student_id}</span></p>
                        <Select value={editSection} onValueChange={onEditSectionChange}>
                            <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                            <SelectContent>
                                {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {editLabGroups.length > 0 && (
                            <Select value={editLab} onValueChange={setEditLab}>
                                <SelectTrigger><SelectValue placeholder="Select Lab Group" /></SelectTrigger>
                                <SelectContent>
                                    {editLabGroups.map(lg => <SelectItem key={lg.id} value={lg.id}>{lg.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                        <Textarea placeholder="Note (optional)" value={editNote} onChange={e => setEditNote(e.target.value)} rows={2} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditReg(null)}>Cancel</Button>
                        <Button onClick={handleEditSave}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
