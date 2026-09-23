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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import {
    Plus, Trash2, Pencil, CheckCircle2, Circle, Download, Upload,
    Users, BookOpen, Clock, LogOut, Lock, Search, Sparkles, AlertCircle, FileText, Check
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { invalidateCacheScopes } from '@/lib/cache/client'
import { getFriendlyErrorMessage } from '@/lib/utils'

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

    // Search & upload
    const [search, setSearch] = useState('')
    const csvRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadTotal, setUploadTotal] = useState(0)
    const [uploadCurrent, setUploadCurrent] = useState(0)

    const getLockedMessage = (message: string) => {
        if (message.toLowerCase().includes('semester_locked')) {
            return 'This semester is locked. CR updates are disabled.'
        }
        return message
    }

    async function fetchActiveSemester() {
        const { data: sem } = await supabase.from('semesters').select('*').eq('is_active', true).single()
        setSemester(sem)
        if (sem) {
            const { data: secs } = await supabase.from('sections').select('*').eq('semester_id', sem.id).order('name')
            setSections(secs || [])
        }
        return sem
    }

    // ── Init ────────────────────────────────────────────────────────────────
    useEffect(() => {
        init()
        const regCh = supabase.channel('cr-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => fetchRegistrations())
            .subscribe()

        const semCh = supabase.channel('cr-sem-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'semesters' }, () => fetchActiveSemester())
            .subscribe()

        return () => {
            supabase.removeChannel(regCh)
            supabase.removeChannel(semCh)
        }
    }, [])

    async function fetchAdvisors() {
        const { data: advs } = await supabase.from('advisors').select('*, student_advisor_ranges(start_id, end_id)').order('name')
        if (advs) setAdvisors(advs)
    }

    async function init() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: staff } = await supabase.from('authorized_staff').select('*').eq('email', user.email).single()
        setCrInfo(staff)

        const sem = await fetchActiveSemester()
        await fetchAdvisors()
        await fetchRegistrations()
        await fetchAuditLogs()
    }

    async function fetchRegistrations() {
        const { data: sem } = await supabase.from('semesters').select('*').eq('is_active', true).maybeSingle()
        if (!sem) return
        const { data } = await supabase
            .from('registrations')
            .select('*, sections!inner(name, semester_id), lab_groups(name), advisors(name), authorized_staff(name, email)')
            .eq('sections.semester_id', sem.id)
            .order('timestamp', { ascending: false })
        if (data) setRegistrations(data)
    }

    async function fetchAuditLogs() {
        const { data } = await supabase
            .from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(150)
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
        if (semester?.is_locked) { toast.error('This semester is locked. CR updates are disabled.'); return }

        // Validate Lab limit
        if (fLab) {
            const targetLab = labGroups.find(l => l.id === fLab)
            const cnt = registrations.filter(r => r.lab_group_id === fLab).length
            const cap = targetLab?.capacity || 25
            if (cnt >= cap) {
                toast.error(`Lab ${targetLab?.name || ''} is full (${cnt}/${cap} seats filled). Please choose another lab group.`)
                return
            }
        }

        // Auto-lookup advisor (global across semesters)
        const numId = parseInt(fId.replace(/-/g, ''))
        let advisorId: string | null = null
        const { data: ranges } = await supabase.from('student_advisor_ranges')
            .select('advisor_id, start_id_numeric, end_id_numeric')
        if (ranges) {
            const match = ranges.find(r => numId >= Number(r.start_id_numeric) && numId <= Number(r.end_id_numeric))
            advisorId = match?.advisor_id || null
        }

        const { data: existing } = await supabase
            .from('registrations')
            .select('id')
            .eq('student_id', fId.trim())
            .maybeSingle()

        let error: any = null
        if (existing) {
            const { error: updateErr } = await supabase.from('registrations').update({
                student_name: fName.trim(),
                section_id: fSection,
                lab_group_id: fLab || null,
                advisor_id: advisorId,
                entered_by: crInfo.id,
                note: fNote.trim(),
                student_edit_count: 0,
                advisor_completed: false,
                advisor_note: null,
                timestamp: new Date().toISOString()
            }).eq('id', existing.id)
            error = updateErr
        } else {
            const { error: insertErr } = await supabase.from('registrations').insert({
                student_name: fName.trim(),
                student_id: fId.trim(),
                section_id: fSection,
                lab_group_id: fLab || null,
                advisor_id: advisorId,
                entered_by: crInfo.id,
                note: fNote.trim(),
                student_edit_count: 0
            })
            error = insertErr
        }

        if (error) {
            const errorMessage = getLockedMessage(error.message)
            toast.error(getFriendlyErrorMessage(errorMessage))
            return
        }

        const secName = sections.find(s => s.id === fSection)?.name || 'Unknown'
        const labName = labGroups.find(l => l.id === fLab)?.name
        const labText = labName ? `, Lab: ${labName}` : ' (No Lab)'
        const noteText = fNote.trim() ? ` | Note: "${fNote.trim()}"` : ''

        // Audit log with CR name and full details
        await supabase.from('audit_logs').insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            role: crInfo?.role || 'cr', 
            action: 'ADD',
            note: `CR ${crInfo?.name || 'Unknown'} (${crInfo?.email || ''}) registered student ${fName.trim()} (${fId.trim()}) to Section ${secName}${labText}${noteText}`
        })

        toast.success('Student registered successfully.')
        await invalidateCacheScopes(['home', 'admin'])
        setFName(''); setFId(''); setFSection(''); setFLab(''); setFNote('')
        setLabGroups([])
        fetchRegistrations()
        fetchAuditLogs()
    }

    // ── Delete Student ───────────────────────────────────────────────────────
    async function handleDelete(reg: any) {
        if (semester?.is_locked) { toast.error('This semester is locked. CR updates are disabled.'); return }
        if (!confirm(`Delete ${reg.student_name} (${reg.student_id}) from section ${reg.sections?.name}?`)) return

        const { error } = await supabase.from('registrations').delete().eq('id', reg.id)
        if (error) { toast.error(getFriendlyErrorMessage(getLockedMessage(error.message))); return }

        const secName = reg.sections?.name || 'Unknown'
        const labText = reg.lab_groups?.name ? `, Lab: ${reg.lab_groups.name}` : ''

        await supabase.from('audit_logs').insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            role: crInfo?.role || 'cr', 
            action: 'DELETE',
            note: `CR ${crInfo?.name || 'Unknown'} (${crInfo?.email || ''}) deleted student ${reg.student_name} (${reg.student_id}) from Section ${secName}${labText}`
        })
        toast.success('Student entry deleted.')
        await invalidateCacheScopes(['home', 'admin'])
        fetchRegistrations(); fetchAuditLogs()
    }

    // ── Edit Student ─────────────────────────────────────────────────────────
    async function openEdit(reg: any) {
        if (semester?.is_locked) { toast.error('This semester is locked. CR updates are disabled.'); return }
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
        if (semester?.is_locked) { toast.error('This semester is locked. CR updates are disabled.'); return }

        // Validate Lab limit
        const labVal = editLab === 'none' ? null : (editLab || null)
        if (labVal) {
            const isCurrentLab = editReg.lab_group_id === labVal
            if (!isCurrentLab) {
                const targetLab = editLabGroups.find(l => l.id === labVal)
                const cnt = registrations.filter(r => r.lab_group_id === labVal && r.id !== editReg.id).length
                const cap = targetLab?.capacity || 25
                if (cnt >= cap) {
                    toast.error(`Lab ${targetLab?.name || ''} is full (${cnt}/${cap} seats filled). Please choose another lab group.`)
                    return
                }
            }
        }

        const { error } = await supabase.from('registrations').update({
            section_id: editSection, lab_group_id: labVal, note: editNote.trim()
        }).eq('id', editReg.id)

        if (error) { toast.error(getFriendlyErrorMessage(getLockedMessage(error.message))); return }

        const oldSecName = editReg.sections?.name || 'Unknown'
        const newSecName = sections.find(s => s.id === editSection)?.name || oldSecName
        const oldLabName = editReg.lab_groups?.name || 'None'
        const newLabName = editLabGroups.find(l => l.id === labVal)?.name || (labVal ? 'None' : 'None')
        const noteText = editNote.trim() ? ` | Note: "${editNote.trim()}"` : ''

        await supabase.from('audit_logs').insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            role: crInfo?.role || 'cr', 
            action: 'EDIT',
            note: `CR ${crInfo?.name || 'Unknown'} (${crInfo?.email || ''}) updated ${editReg.student_name} (${editReg.student_id}) — Section: ${oldSecName} → ${newSecName}, Lab: ${oldLabName} → ${newLabName}${noteText}`
        })

        toast.success('Student updated.')
        await invalidateCacheScopes(['home', 'admin'])
        setEditReg(null)
        fetchRegistrations(); fetchAuditLogs()
    }

    function parseCSVRow(row: string) {
        const result = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < row.length; i++) {
            const char = row[i]
            if (char === '"') {
                inQuotes = !inQuotes
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim())
                current = ''
            } else {
                current += char
            }
        }
        result.push(current.trim())
        return result.map(val => val.replace(/^"|"$/g, ''))
    }

    // ── CSV Import ───────────────────────────────────────────────────────────
    async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !semester || !crInfo) return
        if (semester?.is_locked) { toast.error('This semester is locked. CR updates are disabled.'); return }
        const text = await file.text()
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
        const header = lines[0].toLowerCase()
        if (!header.includes('student_id') && !header.includes('id')) {
            toast.error('CSV must have columns: student_id, student_name, section_name, lab_group_name (optional), note (optional)')
            return
        }
        const rows = lines.slice(1)
        if (rows.length === 0) {
            toast.error('No data found in the CSV file.')
            return
        }

        setUploading(true)
        setUploadProgress(0)
        setUploadTotal(rows.length)
        setUploadCurrent(0)

        let success = 0, fail = 0

        const { data: ranges } = await supabase.from('student_advisor_ranges')
            .select('advisor_id, start_id_numeric, end_id_numeric')

        try {
            for (let i = 0; i < rows.length; i++) {
                const cols = parseCSVRow(rows[i])
                const [studentId, studentName, sectionName, labGroupName, note] = cols
                if (!studentId || !studentName || !sectionName) { 
                    fail++
                    setUploadCurrent(i + 1)
                    setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
                    continue 
                }

                const sec = sections.find(s => s.name.toLowerCase() === sectionName.toLowerCase())
                if (!sec) { 
                    fail++
                    setUploadCurrent(i + 1)
                    setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
                    continue 
                }

                const { data: lgs } = await supabase.from('lab_groups').select('*').eq('section_id', sec.id).order('name')
                const lg = lgs?.find(l => l.name.toLowerCase() === (labGroupName || '').toLowerCase())

                const numId = parseInt(studentId.replace(/-/g, ''))
                const match = (ranges || []).find(r => numId >= Number(r.start_id_numeric) && numId <= Number(r.end_id_numeric))

                const { data: existing } = await supabase
                    .from('registrations')
                    .select('id')
                    .eq('student_id', studentId)
                    .maybeSingle()

                let error: any = null
                if (existing) {
                    const { error: updateErr } = await supabase.from('registrations').update({
                        student_name: studentName,
                        section_id: sec.id,
                        lab_group_id: lg?.id || null,
                        advisor_id: match?.advisor_id || null,
                        entered_by: crInfo.id,
                        note: note || '',
                        student_edit_count: 0,
                        advisor_completed: false,
                        advisor_note: null,
                        timestamp: new Date().toISOString()
                    }).eq('id', existing.id)
                    error = updateErr
                } else {
                    const { error: insertErr } = await supabase.from('registrations').insert({
                        student_id: studentId,
                        student_name: studentName,
                        section_id: sec.id,
                        lab_group_id: lg?.id || null,
                        advisor_id: match?.advisor_id || null,
                        entered_by: crInfo.id,
                        note: note || '',
                        student_edit_count: 0
                    })
                    error = insertErr
                }

                if (error) {
                    const message = error.message || ''
                    if (message.toLowerCase().includes('semester_locked')) {
                        toast.error('This semester is locked. CSV import is disabled for CR users.')
                        break
                    }
                    fail++
                } else success++

                setUploadCurrent(i + 1)
                setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
            }

            if (success > 0) {
                await supabase.from('audit_logs').insert({
                    user_id: (await supabase.auth.getUser()).data.user?.id,
                    role: crInfo?.role || 'cr',
                    action: 'ADD',
                    note: `CR ${crInfo?.name || 'Unknown'} (${crInfo?.email || ''}) bulk-imported ${success} student registration${success > 1 ? 's' : ''} via CSV`
                })
            }

            toast.success(`Import complete: ${success} added, ${fail} failed.`)
        } catch (err: any) {
            toast.error(`Error importing CSV: ${err.message}`)
        } finally {
            setUploading(false)
            if (csvRef.current) csvRef.current.value = ''
            await invalidateCacheScopes(['home', 'admin'])
            fetchRegistrations()
            fetchAuditLogs()
        }
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

    // ── PDF Export / Preview ────────────────────────────────────────────────
    function exportPDF() {
        if (!registrations || registrations.length === 0) {
            toast.error('No registrations to preview.')
            return
        }

        const previewWindow = window.open('', '_blank')
        if (!previewWindow) {
            toast.error('Popup blocked. Please allow popups to open the print preview.')
            return
        }

        const rowsHtml = registrations.map(r => `
            <tr>
                <td>${r.student_id || ''}</td>
                <td>${r.student_name || ''}</td>
                <td>${r.sections?.name || ''}</td>
                <td>${r.lab_groups?.name || '—'}</td>
                <td>${r.advisors?.name || '—'}</td>
                <td>${r.advisor_completed ? 'Yes' : 'No'}</td>
                <td>${r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</td>
            </tr>
        `).join('')

        const html = `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Registrations - ${semester?.name || 'Export'}</title>
    <style>
        @page { size: auto; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; padding: 24px; }
        h1 { font-size: 18px; margin: 0 0 6px; }
        .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; word-wrap: break-word; }
        th { background: #f8fafc; font-weight: 600; text-align: left; }
        tr { break-inside: avoid; page-break-inside: avoid; }
    </style>
</head>
<body>
    <h1>Registrations - ${semester?.name || 'Export'}</h1>
    <div class="meta">Total students: ${registrations.length} · Printed on: ${new Date().toLocaleString()}</div>
    <table>
        <thead>
            <tr>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Section</th>
                <th>Lab Group</th>
                <th>Advisor</th>
                <th>Status</th>
                <th>Timestamp</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
    </table>
</body>
</html>`

        previewWindow.document.open()
        previewWindow.document.write(html)
        previewWindow.document.close()

        const triggerPrint = () => {
            previewWindow.focus()
            previewWindow.print()
        }
        previewWindow.onload = triggerPrint
        setTimeout(triggerPrint, 500)
    }

    const filtered = registrations.filter(r =>
        r.student_id?.toLowerCase().includes(search.toLowerCase()) ||
        r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.sections?.name?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Top Bar Header */}
            <div className="bg-card border-2 border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                            CR Workspace
                        </span>
                        {semester?.is_locked ? (
                            <Badge variant="destructive" className="text-xs gap-1 font-bold">
                                <Lock className="h-3 w-3" /> Semester Locked
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-xs gap-1 font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10">
                                <Check className="h-3 w-3" /> Registration Open
                            </Badge>
                        )}
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground">Class Representative Portal</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                        Manage section registrations, student rosters, and batch imports.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 self-start md:self-auto">
                    <Badge variant="secondary" className="px-3 py-1 text-xs font-bold border border-border">
                        {semester ? semester.name : 'No Active Semester'}
                    </Badge>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                        onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login') }}
                    >
                        <LogOut className="h-3.5 w-3.5 mr-1" /> Logout
                    </Button>
                </div>
            </div>

            {/* Main Tabs Container */}
            <Tabs defaultValue="register" className="space-y-6">
                <div className="border-b-2 border-border pb-px">
                    <TabsList className="bg-muted/40 p-1 rounded-xl h-auto gap-1 border border-border">
                        <TabsTrigger value="register" className="text-xs sm:text-sm rounded-lg py-1.5 px-3 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Register
                        </TabsTrigger>
                        <TabsTrigger value="students" className="text-xs sm:text-sm rounded-lg py-1.5 px-3 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                            <Users className="h-3.5 w-3.5 mr-1.5" /> Students ({registrations.length})
                        </TabsTrigger>
                        <TabsTrigger value="advisors" className="text-xs sm:text-sm rounded-lg py-1.5 px-3 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                            <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Advisors
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-xs sm:text-sm rounded-lg py-1.5 px-3 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                            <Clock className="h-3.5 w-3.5 mr-1.5" /> Audit History ({auditLogs.length})
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ── REGISTER TAB ─────────────────────────────────────────── */}
                <TabsContent value="register" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Single Student Form */}
                        <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                            <div>
                                <h3 className="font-semibold text-base text-foreground">Add Student</h3>
                                <p className="text-xs text-muted-foreground">Register an individual student to an available section &amp; lab group.</p>
                            </div>

                            <form onSubmit={handleRegister} className="space-y-3.5">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Student Full Name *</label>
                                    <Input 
                                        placeholder="e.g. John Doe" 
                                        value={fName} 
                                        onChange={e => setFName(e.target.value)} 
                                        className="h-9 text-xs sm:text-sm"
                                        required 
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Student ID *</label>
                                    <Input 
                                        placeholder="e.g. 241-15-877" 
                                        value={fId} 
                                        onChange={e => setFId(e.target.value)} 
                                        className="h-9 font-mono text-xs sm:text-sm"
                                        required 
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Section *</label>
                                        <Select value={fSection} onValueChange={v => { setFSection(v); loadLabGroups(v) }}>
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Select section" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sections.map(s => {
                                                    const cnt = registrations.filter(r => r.section_id === s.id).length
                                                    const isFull = cnt >= s.capacity
                                                    return (
                                                        <SelectItem key={s.id} value={s.id} disabled={isFull}>
                                                            {s.name} ({cnt}/{s.capacity}){isFull ? ' — FULL' : ''}
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Lab Group</label>
                                        <Select value={fLab} onValueChange={setFLab} disabled={!fSection || labGroups.length === 0}>
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder={labGroups.length === 0 ? "No labs available" : "Select lab group"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {labGroups.map(lg => {
                                                    const cnt = registrations.filter(r => r.lab_group_id === lg.id).length
                                                    const isFull = cnt >= (lg.capacity || 25)
                                                    return (
                                                        <SelectItem key={lg.id} value={lg.id} disabled={isFull}>
                                                            {lg.name} ({cnt}/{lg.capacity || 25}){isFull ? ' — FULL' : ''}
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Note (Optional)</label>
                                    <Textarea 
                                        placeholder="Add any specific context or remarks..." 
                                        value={fNote} 
                                        onChange={e => setFNote(e.target.value)} 
                                        rows={2} 
                                        className="text-xs resize-none"
                                    />
                                </div>

                                <Button 
                                    type="submit" 
                                    className="w-full text-xs font-medium h-9" 
                                    disabled={!semester || semester?.is_locked}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Save Registration
                                </Button>
                            </form>
                        </div>

                        {/* Bulk CSV Import Card */}
                        <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
                            <div className="space-y-1.5">
                                <h3 className="font-semibold text-base text-foreground">Bulk CSV Import</h3>
                                <p className="text-xs text-muted-foreground">
                                    Upload multiple registrations at once. Required headers:
                                </p>
                                <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 text-[11px] font-mono text-muted-foreground">
                                    student_id, student_name, section_name, lab_group_name, note
                                </div>
                            </div>

                            {!uploading ? (
                                <div className="border border-dashed border-border/80 rounded-xl p-6 text-center bg-muted/10 space-y-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                                        <Upload className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-foreground">Upload CSV spreadsheet</p>
                                        <p className="text-[11px] text-muted-foreground">Standard comma-separated format (.csv)</p>
                                    </div>
                                    <input type="file" accept=".csv" ref={csvRef} onChange={handleCSVImport} className="hidden" />
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => csvRef.current?.click()} 
                                        disabled={semester?.is_locked}
                                        className="text-xs"
                                    >
                                        Select CSV File
                                    </Button>
                                </div>
                            ) : (
                                <div className="border border-dashed border-primary/30 rounded-xl p-6 space-y-3 bg-primary/5">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span className="text-primary flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                            Importing data...
                                        </span>
                                        <span className="text-muted-foreground font-mono">{uploadCurrent} / {uploadTotal} ({uploadProgress}%)</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="bg-primary h-full transition-all duration-200" 
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground text-center animate-pulse">
                                        Processing row {uploadCurrent} of {uploadTotal}...
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={exportCSV} disabled={uploading}>
                                    <Download className="w-3.5 h-3.5" /> Export CSV
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={exportPDF} disabled={uploading}>
                                    <FileText className="w-3.5 h-3.5" /> Print / PDF
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ── STUDENTS TAB ─────────────────────────────────────────── */}
                <TabsContent value="students">
                    <div className="bg-card border-2 border-border rounded-2xl shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 border-b-2 border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
                            <div>
                                <h3 className="font-bold text-sm text-foreground">Registered Students</h3>
                                <p className="text-xs text-muted-foreground font-medium">Search and manage section assignments.</p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input 
                                    placeholder="Filter by name or ID..." 
                                    value={search} 
                                    onChange={e => setSearch(e.target.value)} 
                                    className="pl-8 h-8 text-xs bg-background border border-border"
                                />
                            </div>
                        </div>

                        <div className="w-full overflow-x-auto">
                            <Table className="w-full table-auto">
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="text-xs border-b border-border/80">
                                        <TableHead className="w-[125px] font-bold text-foreground">Student ID</TableHead>
                                        <TableHead className="font-bold text-foreground min-w-[150px]">Name</TableHead>
                                        <TableHead className="w-[85px] font-bold text-foreground text-center">Section</TableHead>
                                        <TableHead className="w-[85px] font-bold text-foreground text-center">Lab Group</TableHead>
                                        <TableHead className="font-bold text-foreground min-w-[150px] max-w-[220px]">Advisor</TableHead>
                                        <TableHead className="w-[70px] font-bold text-foreground text-center">Done</TableHead>
                                        <TableHead className="w-[85px] font-bold text-foreground text-right pr-4">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-border/60">
                                    {filtered.map(r => (
                                        <TableRow key={r.id} className={`text-xs hover:bg-muted/40 transition-colors ${r.advisor_completed ? 'bg-primary/5' : ''}`}>
                                            <TableCell className="font-mono font-bold text-foreground py-3 whitespace-nowrap">
                                                {r.student_id}
                                            </TableCell>
                                            <TableCell className="font-medium text-foreground py-3">
                                                <div className="font-semibold text-foreground truncate max-w-[200px] xl:max-w-[280px]">{r.student_name}</div>
                                                {r.note && <div className="text-[10px] text-muted-foreground italic truncate max-w-[200px] xl:max-w-[280px]" title={r.note}>Note: {r.note}</div>}
                                            </TableCell>
                                            <TableCell className="py-3 text-center">
                                                <Badge variant="outline" className="font-mono text-[10px] font-bold border-border bg-muted/40">
                                                    {r.sections?.name}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-3 text-center text-xs">
                                                {r.lab_groups?.name ? (
                                                    <span className="font-mono font-semibold text-foreground/80">{r.lab_groups.name}</span>
                                                ) : (
                                                    <span className="text-muted-foreground/40 font-mono">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3 text-xs text-muted-foreground">
                                                <span className="truncate block max-w-[180px] xl:max-w-[240px]" title={r.advisors?.name || ''}>
                                                    {r.advisors?.name || '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-3 text-center">
                                                {r.advisor_completed ? (
                                                    <span title="Advising Completed" className="inline-flex justify-center w-full">
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                    </span>
                                                ) : (
                                                    <span title="Pending Advising" className="inline-flex justify-center w-full">
                                                        <Circle className="h-4 w-4 text-muted-foreground/30" />
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3 text-right pr-4">
                                                <div className="flex justify-end items-center gap-1">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => openEdit(r)} disabled={semester?.is_locked}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(r)} disabled={semester?.is_locked}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filtered.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs italic">
                                                {search ? 'No matching students found.' : 'No registered students yet.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>

                {/* ── ADVISORS TAB ─────────────────────────────────────────── */}
                <TabsContent value="advisors">
                    <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20">
                            <h3 className="font-semibold text-sm text-foreground">Advisor Distribution Directory</h3>
                            <p className="text-xs text-muted-foreground">Universal advising allocation ranges configured for students.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="text-xs">
                                        <TableHead className="font-semibold">Faculty Name</TableHead>
                                        <TableHead className="font-semibold">Email</TableHead>
                                        <TableHead className="font-semibold">Phone</TableHead>
                                        <TableHead className="font-semibold">Student ID Ranges</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-border/60">
                                    {advisors.map(a => (
                                        <TableRow key={a.id} className="text-xs hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-semibold text-foreground">{a.name}</TableCell>
                                            <TableCell className="font-mono text-muted-foreground">{a.email}</TableCell>
                                            <TableCell className="text-muted-foreground">{a.phone || '—'}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {(a.student_advisor_ranges || []).map((r: any, i: number) => (
                                                        <Badge key={i} variant="outline" className="text-[10px] font-mono">
                                                            {r.start_id} – {r.end_id}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {advisors.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic text-xs">
                                                No advisor records found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>

                {/* ── HISTORY TAB ──────────────────────────────────────────── */}
                <TabsContent value="history">
                    <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">Audit Activity Log</h3>
                                <p className="text-xs text-muted-foreground">Chronological audit stream of last {auditLogs.length} actions.</p>
                            </div>
                            <Badge variant="outline" className="font-mono text-xs">
                                Limit: 150 Events
                            </Badge>
                        </div>
                        <div className="max-h-[540px] overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card border-b border-border/80 z-10">
                                    <TableRow className="text-xs">
                                        <TableHead className="w-[90px] font-semibold">Action</TableHead>
                                        <TableHead className="w-[90px] font-semibold">Role</TableHead>
                                        <TableHead className="font-semibold">Event Description</TableHead>
                                        <TableHead className="text-right w-[160px] font-semibold">Timestamp</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-border/60">
                                    {auditLogs.map(log => (
                                        <TableRow key={log.id} className="text-xs hover:bg-muted/30 transition-colors">
                                            <TableCell>
                                                <Badge 
                                                    variant="outline" 
                                                    className={`text-[10px] font-bold ${
                                                        log.action === 'DELETE' 
                                                            ? 'border-destructive/40 text-destructive bg-destructive/10' 
                                                            : log.action === 'EDIT' 
                                                            ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10' 
                                                            : 'border-primary/40 text-primary bg-primary/10'
                                                    }`}
                                                >
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                                                    {log.role || 'user'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs text-foreground/90 font-medium">
                                                {log.note}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-muted-foreground text-right font-mono">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {auditLogs.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic text-xs">
                                                No activity logged yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Edit Dialog */}
            <Dialog open={!!editReg} onOpenChange={v => !v && setEditReg(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">Edit Student Registration</DialogTitle>
                        <DialogDescription className="text-xs">
                            Modify section or lab group assignment for <span className="font-semibold text-foreground">{editReg?.student_name}</span> ({editReg?.student_id}).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3.5 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Section</label>
                            <Select value={editSection} onValueChange={onEditSectionChange}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Section" /></SelectTrigger>
                                <SelectContent>
                                    {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {editLabGroups.length > 0 && (
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Lab Group</label>
                                <Select value={editLab || 'none'} onValueChange={v => setEditLab(v === 'none' ? '' : v)}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Lab Group" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Lab Group</SelectItem>
                                        {editLabGroups.map(lg => {
                                            const isCurrentLab = editReg?.lab_group_id === lg.id
                                            const cnt = registrations.filter(r => r.lab_group_id === lg.id && r.id !== editReg?.id).length
                                            const cap = lg.capacity || 25
                                            const isFull = cnt >= cap
                                            return (
                                                <SelectItem key={lg.id} value={lg.id} disabled={isFull && !isCurrentLab}>
                                                    {lg.name} ({cnt}/{cap}){isFull && !isCurrentLab ? ' — FULL' : ''}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Note (Optional)</label>
                            <Textarea 
                                placeholder="Edit notes..." 
                                value={editNote} 
                                onChange={e => setEditNote(e.target.value)} 
                                rows={2} 
                                className="text-xs resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditReg(null)}>Cancel</Button>
                        <Button size="sm" className="text-xs" onClick={handleEditSave}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
