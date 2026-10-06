'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { UserPlus, Trash2, ArrowLeft, Plus, Upload, Download, Search, Pencil, Users, Sparkles, Check, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { getFriendlyErrorMessage } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { startImpersonation } from '@/lib/impersonation'
import Link from 'next/link'

export default function AdminEligibleStudentsPage() {
    const supabase = createClient()
    const router = useRouter()
    const csvRef = useRef<HTMLInputElement>(null)

    const [students, setStudents] = useState<any[]>([])
    const [adminEmail, setAdminEmail] = useState('')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(false)

    // Manual form states
    const [name, setName] = useState('')
    const [studentId, setStudentId] = useState('')
    const [email, setEmail] = useState('')

    // Edit states
    const [editStudent, setEditStudent] = useState<any | null>(null)
    const [editName, setEditName] = useState('')
    const [editStudentId, setEditStudentId] = useState('')
    const [editEmail, setEditEmail] = useState('')

    // Upload progress states
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadTotal, setUploadTotal] = useState(0)
    const [uploadCurrent, setUploadCurrent] = useState(0)

    useEffect(() => {
        fetchStudents()
    }, [])

    async function fetchStudents() {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) setAdminEmail(user.email)

        const { data, error } = await supabase
            .from('allowed_students')
            .select('*')
            .order('student_id', { ascending: true })
        if (error) {
            toast.error(getFriendlyErrorMessage(error.message))
        } else {
            setStudents(data || [])
        }
        setLoading(false)
    }

    const handleImpersonateStudent = (s: any) => {
        startImpersonation({
            role: 'student',
            email: s.email || `${s.student_id}@diu.edu.bd`,
            name: s.name,
            studentId: s.student_id,
            originalAdminEmail: adminEmail || 'admin@diu.edu.bd',
            impersonatedAt: new Date().toISOString()
        })
        toast.success(`Impersonating Student ${s.name} (${s.student_id})`)
        router.push('/student/dashboard')
    }

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.student_id.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
    )

    const validateEmailDomain = (emailVal: string) => {
        const domain = emailVal.trim().toLowerCase().split('@')[1] || ''
        return ['diu.edu.bd', 'daffodilvarsity.edu.bd'].includes(domain)
    }

    async function handleAddSingle(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        const trimmedEmail = email.trim().toLowerCase()
        const trimmedStudentId = studentId.trim()
        const trimmedName = name.trim()

        if (!validateEmailDomain(trimmedEmail)) {
            toast.error('Only @diu.edu.bd or @daffodilvarsity.edu.bd domain emails are allowed.')
            setLoading(false)
            return
        }

        const { data: existing } = await supabase
            .from('allowed_students')
            .select('id')
            .or(`student_id.eq.${trimmedStudentId},email.eq.${trimmedEmail}`)
            .maybeSingle()

        if (existing) {
            toast.error('A student with this Student ID or Email already exists in the eligible list.')
            setLoading(false)
            return
        }

        const { error } = await supabase.from('allowed_students').insert({
            student_id: trimmedStudentId,
            name: trimmedName,
            email: trimmedEmail
        })

        if (error) {
            toast.error(getFriendlyErrorMessage(error.message))
        } else {
            toast.success('Student added to eligible list.')
            setName('')
            setStudentId('')
            setEmail('')
            fetchStudents()
        }
        setLoading(false)
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to remove this student from the eligible list?')) return
        const { error } = await supabase.from('allowed_students').delete().eq('id', id)
        if (error) {
            toast.error(getFriendlyErrorMessage(error.message))
        } else {
            toast.success('Student removed from eligible list.')
            fetchStudents()
        }
    }

    function openEdit(student: any) {
        setEditStudent(student)
        setEditName(student.name)
        setEditStudentId(student.student_id)
        setEditEmail(student.email)
    }

    async function handleEditSave(e: React.FormEvent) {
        e.preventDefault()
        if (!editStudent) return
        setLoading(true)

        const trimmedEmail = editEmail.trim().toLowerCase()
        const trimmedStudentId = editStudentId.trim()
        const trimmedName = editName.trim()

        if (!validateEmailDomain(trimmedEmail)) {
            toast.error('Only @diu.edu.bd or @daffodilvarsity.edu.bd domains are allowed.')
            setLoading(false)
            return
        }

        const { error } = await supabase.from('allowed_students').update({
            name: trimmedName,
            student_id: trimmedStudentId,
            email: trimmedEmail
        }).eq('id', editStudent.id)

        if (error) {
            toast.error(getFriendlyErrorMessage(error.message))
        } else {
            if (editStudent.email.toLowerCase() !== trimmedEmail) {
                await supabase.from('authorized_staff')
                    .update({ email: trimmedEmail, name: trimmedName })
                    .eq('email', editStudent.email)
            } else {
                await supabase.from('authorized_staff')
                    .update({ name: trimmedName })
                    .eq('email', editStudent.email)
            }

            toast.success('Eligible student updated.')
            setEditStudent(null)
            fetchStudents()
        }
        setLoading(false)
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

    async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        setUploadProgress(0)
        setUploadCurrent(0)

        try {
            const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
            let rows: string[][] = []
            let studentIdIdx = -1
            let nameIdx = -1
            let emailIdx = -1

            if (isExcel) {
                const XLSX = await import('xlsx')
                const data = await file.arrayBuffer()
                const workbook = XLSX.read(data, { type: 'array' })
                const firstSheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[firstSheetName]
                const jsonSheet = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 })
                if (jsonSheet.length <= 1) {
                    toast.error('The Excel file is empty or has no data rows.')
                    setUploading(false)
                    return
                }

                const headers = jsonSheet[0].map((h: any) => String(h || '').trim().toLowerCase())
                studentIdIdx = headers.findIndex(h => h.includes('id') || h.includes('student_id'))
                nameIdx = headers.indexOf('name')
                emailIdx = headers.indexOf('email')

                if (studentIdIdx === -1 || nameIdx === -1 || emailIdx === -1) {
                    toast.error('Excel header must contain "student_id", "name", and "email" columns.')
                    setUploading(false)
                    return
                }

                rows = jsonSheet.slice(1).map((row: any) => {
                    const length = Math.max(studentIdIdx + 1, nameIdx + 1, emailIdx + 1, row.length)
                    const normalized = []
                    for (let idx = 0; idx < length; idx++) {
                        normalized.push(row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '')
                    }
                    return normalized
                })
            } else {
                const text = await file.text()
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
                if (lines.length <= 1) {
                    toast.error('The CSV file is empty or has no data rows.')
                    setUploading(false)
                    return
                }

                const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
                studentIdIdx = headers.findIndex(h => h.includes('id') || h.includes('student_id'))
                nameIdx = headers.indexOf('name')
                emailIdx = headers.indexOf('email')

                if (studentIdIdx === -1 || nameIdx === -1 || emailIdx === -1) {
                    toast.error('CSV header must contain "student_id", "name", and "email" columns.')
                    setUploading(false)
                    return
                }

                rows = lines.slice(1).map(row => parseCSVRow(row))
            }

            setUploadTotal(rows.length)
            let success = 0
            let skipped = 0
            let failed = 0

            for (let i = 0; i < rows.length; i++) {
                const cols = rows[i]
                const rowStudentId = cols[studentIdIdx]
                const rowName = cols[nameIdx]
                const rowEmail = cols[emailIdx]

                if (!rowStudentId || !rowName || !rowEmail) {
                    failed++
                    setUploadCurrent(i + 1)
                    setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
                    continue
                }

                if (!validateEmailDomain(rowEmail)) {
                    failed++
                    setUploadCurrent(i + 1)
                    setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
                    continue
                }

                const { data: existing } = await supabase
                    .from('allowed_students')
                    .select('id')
                    .or(`student_id.eq.${rowStudentId.trim()},email.eq.${rowEmail.trim().toLowerCase()}`)
                    .maybeSingle()

                if (existing) {
                    skipped++
                    setUploadCurrent(i + 1)
                    setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
                    continue
                }

                const { error } = await supabase.from('allowed_students').insert({
                    student_id: rowStudentId.trim(),
                    name: rowName.trim(),
                    email: rowEmail.trim().toLowerCase()
                })

                if (error) {
                    failed++
                } else {
                    success++
                }

                setUploadCurrent(i + 1)
                setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
            }

            toast.success(`Import complete: ${success} added, ${skipped} skipped, ${failed} failed.`)
            fetchStudents()
        } catch (err: any) {
            toast.error(`Error importing file: ${getFriendlyErrorMessage(err.message)}`)
        } finally {
            setUploading(false)
            if (csvRef.current) csvRef.current.value = ''
        }
    }

    function exportCSV() {
        if (students.length === 0) {
            toast.error('No student data available to export.')
            return
        }
        const headers = ['Student ID', 'Name', 'Email']
        const rows = students.map(s => [
            s.student_id || '',
            s.name || '',
            s.email || ''
        ])
        const csv = [headers, ...rows].map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'eligible_students.csv'
        a.click()
        toast.success('Eligible students exported to CSV.')
    }

    function downloadTemplate() {
        const csvContent = "student_id,name,email\n241-15-101,Karim Al-Hasan,student@diu.edu.bd\n"
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'eligible_students_template.csv'
        a.click()
        toast.success('Template CSV downloaded.')
    }

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <Link 
                href="/admin" 
                className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to Admin Console
            </Link>

            {/* Header */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        Authorization Access
                    </span>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Eligible Students Directory</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Pre-authorize university students for self-service section pre-registration.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono bg-muted/30">
                        {students.length} Authorized
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Authorization form side */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-4">
                        <div className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-primary" />
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">Authorize Students</h3>
                                <p className="text-xs text-muted-foreground">Single entry or batch upload.</p>
                            </div>
                        </div>

                        <Tabs defaultValue="single">
                            <TabsList className="grid grid-cols-2 bg-muted/40 p-1 rounded-xl h-auto mb-3">
                                <TabsTrigger value="single" className="text-xs py-1.5 rounded-lg data-[state=active]:bg-card">
                                    Single Add
                                </TabsTrigger>
                                <TabsTrigger value="bulk" className="text-xs py-1.5 rounded-lg data-[state=active]:bg-card">
                                    Bulk Import
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="single">
                                <form onSubmit={handleAddSingle} className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground block mb-1">Student ID *</label>
                                        <Input
                                            placeholder="241-15-101"
                                            value={studentId}
                                            onChange={e => setStudentId(e.target.value)}
                                            required
                                            disabled={loading}
                                            className="h-9 text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground block mb-1">Full Name *</label>
                                        <Input
                                            placeholder="Karim Al-Hasan"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            required
                                            disabled={loading}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground block mb-1">DIU Email *</label>
                                        <Input
                                            type="email"
                                            placeholder="student@diu.edu.bd"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                            disabled={loading}
                                            className="h-9 text-xs font-mono"
                                        />
                                    </div>
                                    <Button type="submit" size="sm" className="w-full text-xs font-medium h-9" disabled={loading}>
                                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Authorize Student
                                    </Button>
                                </form>
                            </TabsContent>

                            <TabsContent value="bulk" className="space-y-3">
                                <p className="text-xs text-muted-foreground">
                                    Upload CSV or Excel sheet with columns: <code className="font-mono text-[11px] bg-muted px-1 rounded">student_id, name, email</code>
                                </p>
                                <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full text-xs h-8">
                                    <Download className="h-3 w-3 mr-1" /> Download CSV Template
                                </Button>
                                
                                <div className="border border-dashed border-border/80 rounded-xl p-5 text-center bg-muted/10 hover:bg-muted/20 transition-colors relative">
                                    <Input
                                        type="file"
                                        ref={csvRef}
                                        accept=".csv, .xlsx, .xls"
                                        onChange={handleCSVImport}
                                        disabled={uploading}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
                                    <p className="text-xs font-medium text-foreground">Click or drop CSV / Excel file here</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">.csv, .xlsx, or .xls</p>
                                </div>

                                {uploading && (
                                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
                                        <div className="flex justify-between text-xs font-medium text-primary">
                                            <span>Importing rows...</span>
                                            <span className="font-mono">{uploadCurrent}/{uploadTotal} ({uploadProgress}%)</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                {/* Table list side */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">Eligible Student Records</h3>
                                <p className="text-xs text-muted-foreground">Authorized students list.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={exportCSV} disabled={students.length === 0}>
                                    <Download className="h-3.5 w-3.5" /> Export CSV
                                </Button>
                            </div>
                        </div>

                        <div className="p-4 border-b border-border/60">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Filter by ID, name, or email..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-background"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="text-xs">
                                        <TableHead className="font-semibold">Student ID</TableHead>
                                        <TableHead className="font-semibold">Name</TableHead>
                                        <TableHead className="font-semibold">Email</TableHead>
                                        <TableHead className="text-right font-semibold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-border/60">
                                    {filteredStudents.map(s => (
                                        <TableRow key={s.id} className="text-xs hover:bg-muted/30">
                                            <TableCell className="font-mono font-medium text-foreground py-3">{s.student_id}</TableCell>
                                            <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                                            <TableCell className="font-mono text-muted-foreground">{s.email}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10" title="Impersonate Student" onClick={() => handleImpersonateStudent(s)}>
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(s)}>
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(s.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredStudents.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic text-xs">
                                                {search ? 'No matching student records found.' : 'No eligible students loaded yet.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editStudent} onOpenChange={v => !v && setEditStudent(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">Edit Eligible Student</DialogTitle>
                        <DialogDescription className="text-xs">
                            Update details for <span className="font-semibold text-foreground">{editStudent?.name}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSave} className="space-y-3 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Student ID</label>
                            <Input value={editStudentId} onChange={e => setEditStudentId(e.target.value)} className="h-9 text-xs font-mono" required disabled={loading} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Full Name</label>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-9 text-xs" required disabled={loading} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">DIU Email</label>
                            <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-9 text-xs font-mono" required disabled={loading} />
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0 pt-2">
                            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setEditStudent(null)} disabled={loading}>
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" className="text-xs" disabled={loading}>
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
