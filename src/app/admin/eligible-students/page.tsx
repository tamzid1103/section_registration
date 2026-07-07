'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { UserPlus, Trash2, ChevronLeft, Plus, Upload, Download, Search, RefreshCw, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AdminEligibleStudentsPage() {
    const supabase = createClient()
    const csvRef = useRef<HTMLInputElement>(null)

    const [students, setStudents] = useState<any[]>([])
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
        const { data, error } = await supabase
            .from('allowed_students')
            .select('*')
            .order('student_id', { ascending: true })
        if (error) {
            toast.error(error.message)
        } else {
            setStudents(data || [])
        }
        setLoading(false)
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

        // Check duplicates
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
            toast.error(error.message)
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
            toast.error(error.message)
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
            toast.error(error.message.includes('duplicate') ? 'Student ID or Email already in use.' : error.message)
        } else {
            // Update staff table too if email/name changes
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
            const text = await file.text()
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
            if (lines.length <= 1) {
                toast.error('The CSV file is empty or has no data rows.')
                setUploading(false)
                return
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
            const studentIdIdx = headers.findIndex(h => h.includes('id') || h.includes('student_id'))
            const nameIdx = headers.indexOf('name')
            const emailIdx = headers.indexOf('email')

            if (studentIdIdx === -1 || nameIdx === -1 || emailIdx === -1) {
                toast.error('CSV header must contain "student_id", "name", and "email" columns.')
                setUploading(false)
                return
            }

            const rows = lines.slice(1)
            setUploadTotal(rows.length)
            let success = 0
            let skipped = 0
            let failed = 0

            for (let i = 0; i < rows.length; i++) {
                const cols = parseCSVRow(rows[i])
                const rowStudentId = cols[studentIdIdx]
                const rowName = cols[nameIdx]
                const rowEmail = cols[emailIdx]

                if (!rowStudentId || !rowName || !rowEmail) {
                    failed++
                    setUploadCurrent(i + 1)
                    setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
                    continue
                }

                // Check domain
                if (!validateEmailDomain(rowEmail)) {
                    failed++
                    setUploadCurrent(i + 1)
                    setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
                    continue
                }

                // Check duplicates (ignore double entries)
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
                    console.error('Failed to import row:', error.message)
                    failed++
                } else {
                    success++
                }

                setUploadCurrent(i + 1)
                setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
            }

            toast.success(`Import complete: ${success} added, ${skipped} duplicates skipped, ${failed} failed.`)
            fetchStudents()
        } catch (err: any) {
            toast.error(`Error importing CSV: ${err.message}`)
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
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/admin"><ChevronLeft className="h-4 w-4 mr-1" /> Back to Dashboard</Link>
                </Button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Eligible Students</h1>
                    <p className="text-muted-foreground mt-1">Pre-authorize students so they can self-register using their university email.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Operations side */}
                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Manage Access</CardTitle>
                            <CardDescription>Authorize eligible students</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="single">
                                <TabsList className="grid grid-cols-2 mb-4">
                                    <TabsTrigger value="single">Single Add</TabsTrigger>
                                    <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
                                </TabsList>

                                <TabsContent value="single">
                                    <form onSubmit={handleAddSingle} className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-semibold">Student ID</label>
                                            <Input
                                                placeholder="241-15-101"
                                                value={studentId}
                                                onChange={e => setStudentId(e.target.value)}
                                                required
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-semibold">Full Name</label>
                                            <Input
                                                placeholder="Karim Al-Hasan"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                required
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-semibold">DIU Email</label>
                                            <Input
                                                type="email"
                                                placeholder="name@diu.edu.bd"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                required
                                                disabled={loading}
                                            />
                                        </div>
                                        <Button type="submit" className="w-full" disabled={loading}>
                                            <UserPlus className="h-4 w-4 mr-2" /> Authorize Student
                                        </Button>
                                    </form>
                                </TabsContent>

                                <TabsContent value="bulk" className="space-y-4">
                                    <p className="text-xs text-muted-foreground">Upload a CSV file containing <strong>student_id</strong>, <strong>name</strong>, and <strong>email</strong> columns.</p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
                                            <Download className="h-3.5 w-3.5 mr-1" /> Template CSV
                                        </Button>
                                    </div>
                                    <div className="border-2 border-dashed rounded-xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors relative">
                                        <Input
                                            type="file"
                                            ref={csvRef}
                                            accept=".csv"
                                            onChange={handleCSVImport}
                                            disabled={uploading}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                        <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                                        <p className="text-sm font-medium">Click or drag CSV here</p>
                                        <p className="text-xs text-muted-foreground mt-1">Accepts only .csv files</p>
                                    </div>

                                    {uploading && (
                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                                            <div className="flex justify-between text-xs font-semibold text-blue-700">
                                                <span>Importing Students...</span>
                                                <span>{uploadCurrent}/{uploadTotal} ({uploadProgress}%)</span>
                                            </div>
                                            <div className="w-full bg-blue-100 h-2.5 rounded-full overflow-hidden">
                                                <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

                {/* List side */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle>Eligible Students List</CardTitle>
                                <CardDescription>All students permitted to register</CardDescription>
                            </div>
                            <Button size="sm" variant="outline" onClick={exportCSV} disabled={students.length === 0}>
                                <Download className="h-4 w-4 mr-1" /> Export CSV
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search by ID, name, or email..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student ID</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStudents.map(s => (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-mono text-sm">{s.student_id}</TableCell>
                                                <TableCell className="font-medium">{s.name}</TableCell>
                                                <TableCell className="text-muted-foreground text-sm">{s.email}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(s.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredStudents.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">
                                                    {search ? 'No matches found.' : 'No eligible students loaded yet.'}
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

            {/* Edit Dialog */}
            <Dialog open={!!editStudent} onOpenChange={v => !v && setEditStudent(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Eligible Student</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSave} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Student ID</label>
                            <Input value={editStudentId} onChange={e => setEditStudentId(e.target.value)} required disabled={loading} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Full Name</label>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} required disabled={loading} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">DIU Email</label>
                            <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required disabled={loading} />
                        </div>
                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setEditStudent(null)} disabled={loading}>Cancel</Button>
                            <Button type="submit" disabled={loading}>Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
