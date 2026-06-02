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
import { UserPlus, Trash2, ChevronLeft, Plus, Upload, Download, FileText, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AdminAdvisorsPage() {
    const [advisors, setAdvisors] = useState<any[]>([])
    const [semesters, setSemesters] = useState<any[]>([])
    const [ranges, setRanges] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    // Edit advisor states
    const [editAdvisor, setEditAdvisor] = useState<any | null>(null)
    const [editName, setEditName] = useState('')
    const [editEmail, setEditEmail] = useState('')
    const [editPhone, setEditPhone] = useState('')
    const [editDesignation, setEditDesignation] = useState('')

    // Upload progress states
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadTotal, setUploadTotal] = useState(0)
    const [uploadCurrent, setUploadCurrent] = useState(0)
    const csvRef = useRef<HTMLInputElement>(null)

    // New advisor form
    const [newName, setNewName] = useState('')
    const [newEmail, setNewEmail] = useState('')
    const [newPhone, setNewPhone] = useState('')
    const [newDesignation, setNewDesignation] = useState('')

    // New range form
    const [rangeAdvisorId, setRangeAdvisorId] = useState('')
    const [rangeSemesterId, setRangeSemesterId] = useState('')
    const [rangeStart, setRangeStart] = useState('')
    const [rangeEnd, setRangeEnd] = useState('')

    const supabase = createClient()

    useEffect(() => {
        fetchAll()
    }, [])

    async function fetchAll() {
        const [{ data: adv }, { data: sem }, { data: rng }] = await Promise.all([
            supabase.from('advisors').select('*').order('name'),
            supabase.from('semesters').select('*').order('created_at', { ascending: false }),
            supabase.from('student_advisor_ranges').select(`*, advisors(name), semesters(name)`).order('created_at'),
        ])
        if (adv) setAdvisors(adv)
        if (sem) setSemesters(sem)
        if (rng) setRanges(rng)
    }

    async function handleAddAdvisor(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const { error } = await supabase.from('advisors').insert({
            name: newName.trim(),
            email: newEmail.trim().toLowerCase(),
            phone: newPhone.trim() || null,
            designation: newDesignation.trim() || null,
        })
        if (error) {
            toast.error(error.message.includes('duplicate') ? 'Email already in advisor list.' : error.message)
        } else {
            toast.success('Advisor added to the system.')
            setNewName(''); setNewEmail(''); setNewPhone(''); setNewDesignation('')
            fetchAll()
        }
        setLoading(false)
    }

    async function handleDeleteAdvisor(id: string) {
        if (!confirm('Remove this advisor? Their student ID ranges will also be deleted.')) return
        const { error } = await supabase.from('advisors').delete().eq('id', id)
        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Advisor removed.')
            // Also remove from authorized_staff
            const adv = advisors.find(a => a.id === id)
            if (adv) await supabase.from('authorized_staff').delete().eq('email', adv.email)
            fetchAll()
        }
    }

    function openEdit(adv: any) {
        setEditAdvisor(adv)
        setEditName(adv.name || '')
        setEditEmail(adv.email || '')
        setEditPhone(adv.phone || '')
        setEditDesignation(adv.designation || '')
    }

    async function handleEditSave(e: React.FormEvent) {
        e.preventDefault()
        if (!editAdvisor) return
        setLoading(true)
        
        const oldEmail = editAdvisor.email
        const newEmailTrim = editEmail.trim().toLowerCase()
        const newNameTrim = editName.trim()
        
        const { error } = await supabase.from('advisors').update({
            name: newNameTrim,
            email: newEmailTrim,
            phone: editPhone.trim() || null,
            designation: editDesignation.trim() || null
        }).eq('id', editAdvisor.id)
        
        if (error) {
            toast.error(error.message.includes('duplicate') ? 'Email already in use.' : error.message)
            setLoading(false)
            return
        }
        
        if (oldEmail.toLowerCase() !== newEmailTrim) {
            await supabase.from('authorized_staff')
                .update({ email: newEmailTrim, name: newNameTrim })
                .eq('email', oldEmail)
        } else {
            await supabase.from('authorized_staff')
                .update({ name: newNameTrim })
                .eq('email', oldEmail)
        }
        
        toast.success('Advisor info updated.')
        setEditAdvisor(null)
        fetchAll()
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

    function exportCSV() {
        if (advisors.length === 0) {
            toast.error('No advisor data available to export.')
            return
        }
        const headers = ['Name', 'Email', 'Phone', 'Designation']
        const rows = advisors.map(a => [
            a.name || '',
            a.email || '',
            a.phone || '',
            a.designation || ''
        ])
        const csv = [headers, ...rows].map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'advisors.csv'
        a.click()
        toast.success('Advisors list exported to CSV.')
    }

    async function exportPDF() {
        if (advisors.length === 0) {
            toast.error('No advisor data available to export.')
            return
        }
        try {
            const { jsPDF } = await import('jspdf')
            const doc = new jsPDF()

            // Header banner
            doc.setFillColor(30, 41, 59) // slate-800
            doc.rect(0, 0, 210, 40, 'F')

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(22)
            doc.setTextColor(255, 255, 255)
            doc.text('DIU Section Pre-Registration', 14, 20)

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(12)
            doc.setTextColor(226, 232, 240) // slate-200
            doc.text('Registered Advisors Directory', 14, 28)

            // Content metadata
            doc.setFontSize(10)
            doc.setTextColor(100, 116, 139) // slate-500
            doc.text(`Total Registered Advisors: ${advisors.length}`, 14, 50)
            doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 56)

            doc.setDrawColor(226, 232, 240) // slate-200
            doc.line(14, 60, 196, 60)

            let y = 70

            // Table Header
            doc.setFillColor(248, 250, 252) // slate-50
            doc.rect(14, y - 6, 182, 8, 'F')
            
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(10)
            doc.setTextColor(30, 41, 59) // slate-800
            doc.text('Name', 16, y - 1)
            doc.text('Email', 65, y - 1)
            doc.text('Phone', 125, y - 1)
            doc.text('Designation', 155, y - 1)

            doc.line(14, y + 2, 196, y + 2)
            y += 8

            doc.setFont('helvetica', 'normal')
            doc.setTextColor(71, 85, 105) // slate-600

            advisors.forEach((adv, index) => {
                if (y > 275) {
                    doc.addPage()
                    y = 25

                    // Table Header on new page
                    doc.setFillColor(248, 250, 252) // slate-50
                    doc.rect(14, y - 6, 182, 8, 'F')
                    
                    doc.setFont('helvetica', 'bold')
                    doc.setFontSize(10)
                    doc.setTextColor(30, 41, 59) // slate-800
                    doc.text('Name', 16, y - 1)
                    doc.text('Email', 65, y - 1)
                    doc.text('Phone', 125, y - 1)
                    doc.text('Designation', 155, y - 1)
                    doc.line(14, y + 2, 196, y + 2)
                    y += 8
                    doc.setFont('helvetica', 'normal')
                    doc.setTextColor(71, 85, 105)
                }

                // Alternating row colors
                if (index % 2 === 1) {
                    doc.setFillColor(250, 250, 250)
                    doc.rect(14, y - 5, 182, 7, 'F')
                }

                const name = adv.name || ''
                const email = adv.email || ''
                const phone = adv.phone || '—'
                const designation = adv.designation || '—'

                const truncName = name.length > 25 ? name.substring(0, 22) + '...' : name
                const truncEmail = email.length > 28 ? email.substring(0, 25) + '...' : email
                const truncPhone = phone.length > 15 ? phone.substring(0, 12) + '...' : phone
                const truncDesignation = designation.length > 22 ? designation.substring(0, 19) + '...' : designation

                doc.text(truncName, 16, y)
                doc.text(truncEmail, 65, y)
                doc.text(truncPhone, 125, y)
                doc.text(truncDesignation, 155, y)

                y += 8
            })

            doc.save('registered_advisors.pdf')
            toast.success('Advisors list exported to PDF.')
        } catch (err: any) {
            console.error('Error generating PDF:', err)
            toast.error('Could not generate PDF. Please try again.')
        }
    }

    function downloadTemplate() {
        const csvContent = "name,email,phone,designation\nDr. Abc Rahman,advisor@diu.edu.bd,01711111111,Associate Professor\n"
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'advisors_template.csv'
        a.click()
        toast.success('Template CSV downloaded.')
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
            const nameIdx = headers.indexOf('name')
            const emailIdx = headers.indexOf('email')
            const phoneIdx = headers.indexOf('phone')
            const designationIdx = headers.indexOf('designation')

            if (nameIdx === -1 || emailIdx === -1) {
                toast.error('CSV header must contain at least "name" and "email" columns.')
                setUploading(false)
                return
            }

            const rows = lines.slice(1)
            setUploadTotal(rows.length)
            let success = 0
            let fail = 0

            for (let i = 0; i < rows.length; i++) {
                const cols = parseCSVRow(rows[i])
                const name = cols[nameIdx]
                const email = cols[emailIdx]
                const phone = phoneIdx !== -1 ? cols[phoneIdx] : ''
                const designation = designationIdx !== -1 ? cols[designationIdx] : ''

                if (!name || !email) {
                    fail++
                    setUploadCurrent(i + 1)
                    setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
                    continue
                }

                // Check if email domain is valid
                const domain = email.trim().toLowerCase().split('@')[1] || ''
                const allowedDomains = ['diu.edu.bd', 'daffodilvarsity.edu.bd']
                if (!allowedDomains.includes(domain)) {
                    fail++
                    setUploadCurrent(i + 1)
                    setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
                    continue
                }

                const { error } = await supabase.from('advisors').insert({
                    name: name.trim(),
                    email: email.trim().toLowerCase(),
                    phone: phone.trim() || null,
                    designation: designation.trim() || null
                })

                if (error) {
                    console.error('Failed to import advisor row:', error.message)
                    fail++
                } else {
                    success++
                }

                setUploadCurrent(i + 1)
                setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
            }

            toast.success(`Import complete: ${success} advisors added, ${fail} failed.`)
            fetchAll()
        } catch (err: any) {
            toast.error(`Error importing CSV: ${err.message}`)
        } finally {
            setUploading(false)
            if (csvRef.current) csvRef.current.value = ''
        }
    }

    async function handleAddRange(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        // Validate ID format (e.g. 241-15-001)
        const idPattern = /^\d{3}-\d{2}-\d{3,4}$/
        if (!idPattern.test(rangeStart) || !idPattern.test(rangeEnd)) {
            toast.error('ID format must be like 241-15-001 (use hyphens, no spaces)')
            setLoading(false)
            return
        }
        const { error } = await supabase.from('student_advisor_ranges').insert({
            advisor_id: rangeAdvisorId,
            semester_id: rangeSemesterId,
            start_id: rangeStart.trim(),
            end_id: rangeEnd.trim(),
        })
        if (error) {
            toast.error(error.message)
        } else {
            toast.success('ID range assigned.')
            setRangeStart(''); setRangeEnd(''); setRangeAdvisorId(''); setRangeSemesterId('')
            fetchAll()
        }
        setLoading(false)
    }

    async function handleDeleteRange(id: string) {
        await supabase.from('student_advisor_ranges').delete().eq('id', id)
        toast.success('Range removed.')
        fetchAll()
    }

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/admin"><ChevronLeft className="h-4 w-4" /> Back</Link>
                </Button>
                <h1 className="text-3xl font-bold">Advisor Management</h1>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Advisor Administration */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex gap-2 items-center">
                            <UserPlus className="h-5 w-5" /> Advisor Administration
                        </CardTitle>
                        <CardDescription>
                            Add a single advisor or perform bulk operations using CSV.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="single" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="single" disabled={uploading}>Single Advisor</TabsTrigger>
                                <TabsTrigger value="bulk" disabled={uploading}>Bulk Operations</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="single">
                                <form onSubmit={handleAddAdvisor} className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Full Name *</label>
                                        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Dr. Abc Rahman" required />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">DIU Email *</label>
                                        <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="advisor@diu.edu.bd" required />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Phone Number</label>
                                        <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="01XXXXXXXXX" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Designation</label>
                                        <Input value={newDesignation} onChange={e => setNewDesignation(e.target.value)} placeholder="Associate Professor" />
                                    </div>
                                    <Button type="submit" className="w-full gap-2" disabled={loading}>
                                        <Plus className="h-4 w-4" /> Add Advisor
                                    </Button>
                                </form>
                            </TabsContent>
                            
                            <TabsContent value="bulk" className="space-y-4">
                                {!uploading ? (
                                    <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
                                        <Upload className="w-8 h-8 mx-auto text-slate-400" />
                                        <div>
                                            <p className="text-sm font-medium">Upload Advisor CSV</p>
                                            <p className="text-xs text-muted-foreground mt-1">Columns: name, email, phone (optional), designation (optional)</p>
                                        </div>
                                        <input type="file" accept=".csv" ref={csvRef} onChange={handleCSVImport} className="hidden" />
                                        <div className="flex gap-2 justify-center">
                                            <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}>
                                                Choose File
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                                                Download Template
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed rounded-lg p-6 space-y-4">
                                        <div className="flex justify-between text-sm font-medium">
                                            <span className="text-primary flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                                Uploading Advisors...
                                            </span>
                                            <span className="text-muted-foreground">{uploadCurrent} / {uploadTotal} ({uploadProgress}%)</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3">
                                            <div 
                                                className="bg-primary h-3 rounded-full transition-all duration-300 shadow-sm" 
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground text-center animate-pulse">
                                            Processing advisor row {uploadCurrent} of {uploadTotal}...
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1 gap-2" onClick={exportCSV} disabled={uploading}>
                                        <Download className="w-4 h-4" /> Export CSV
                                    </Button>
                                    <Button variant="outline" className="flex-1 gap-2" onClick={exportPDF} disabled={uploading}>
                                        <FileText className="w-4 h-4" /> Export PDF
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Assign ID Range */}
                <Card>
                    <CardHeader>
                        <CardTitle>Assign Student ID Range</CardTitle>
                        <CardDescription>
                            Each advisor handles a range of student IDs. Format: 241-15-001
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddRange} className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Advisor *</label>
                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={rangeAdvisorId}
                                    onChange={e => setRangeAdvisorId(e.target.value)}
                                    required
                                >
                                    <option value="">Select advisor</option>
                                    {advisors.map(a => (
                                        <option key={a.id} value={a.id}>{a.name} — {a.email}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Semester *</label>
                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={rangeSemesterId}
                                    onChange={e => setRangeSemesterId(e.target.value)}
                                    required
                                >
                                    <option value="">Select semester</option>
                                    {semesters.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' (Active)' : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Start ID *</label>
                                    <Input
                                        value={rangeStart}
                                        onChange={e => setRangeStart(e.target.value)}
                                        placeholder="241-15-001"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">End ID *</label>
                                    <Input
                                        value={rangeEnd}
                                        onChange={e => setRangeEnd(e.target.value)}
                                        placeholder="241-15-065"
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="w-full gap-2" disabled={loading}>
                                <Plus className="h-4 w-4" /> Assign Range
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Advisors List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle>Registered Advisors ({advisors.length})</CardTitle>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} disabled={uploading}>
                            <Download className="h-4 w-4" /> Export CSV
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" onClick={exportPDF} disabled={uploading}>
                            <FileText className="h-4 w-4" /> Export PDF
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Designation</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {advisors.map(a => (
                                <TableRow key={a.id}>
                                    <TableCell className="font-medium">{a.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{a.email}</TableCell>
                                    <TableCell className="text-sm">{a.phone || '—'}</TableCell>
                                    <TableCell className="text-sm">{a.designation || '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                size="sm" variant="ghost"
                                                onClick={() => openEdit(a)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm" variant="ghost"
                                                className="text-destructive"
                                                onClick={() => handleDeleteAdvisor(a.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {advisors.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                        No advisors added yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Ranges List */}
            <Card>
                <CardHeader>
                    <CardTitle>Assigned Student ID Ranges</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Advisor</TableHead>
                                <TableHead>Semester</TableHead>
                                <TableHead>Start ID</TableHead>
                                <TableHead>End ID</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ranges.map(r => (
                                <TableRow key={r.id}>
                                    <TableCell className="font-medium">{r.advisors?.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{r.semesters?.name}</Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">{r.start_id}</TableCell>
                                    <TableCell className="font-mono text-sm">{r.end_id}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm" variant="ghost"
                                            className="text-destructive"
                                            onClick={() => handleDeleteRange(r.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {ranges.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                        No ranges assigned yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Advisor Dialog */}
            <Dialog open={!!editAdvisor} onOpenChange={v => !v && setEditAdvisor(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Advisor Info</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSave} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Full Name</label>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">DIU Email</label>
                            <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Phone Number</label>
                            <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Designation</label>
                            <Input value={editDesignation} onChange={e => setEditDesignation(e.target.value)} />
                        </div>
                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setEditAdvisor(null)} disabled={loading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
