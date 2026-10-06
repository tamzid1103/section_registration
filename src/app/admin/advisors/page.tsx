'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { UserPlus, Trash2, ArrowLeft, Plus, Upload, Download, FileText, Pencil, GraduationCap, Layers, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { getFriendlyErrorMessage } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { startImpersonation } from '@/lib/impersonation'
import Link from 'next/link'

export default function AdminAdvisorsPage() {
    const router = useRouter()
    const [adminEmail, setAdminEmail] = useState('')
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
    const [rangeStart, setRangeStart] = useState('')
    const [rangeEnd, setRangeEnd] = useState('')

    const supabase = createClient()

    useEffect(() => {
        fetchAll()
    }, [])

    async function fetchAll() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) setAdminEmail(user.email)

        const [{ data: adv }, { data: sem }, { data: rng }] = await Promise.all([
            supabase.from('advisors').select('*').order('name'),
            supabase.from('semesters').select('*').order('created_at', { ascending: false }),
            supabase.from('student_advisor_ranges').select(`*, advisors(name)`).order('created_at'),
        ])
        if (adv) setAdvisors(adv)
        if (sem) setSemesters(sem)
        if (rng) setRanges(rng)
    }

    const handleImpersonateAdvisor = (adv: any) => {
        startImpersonation({
            role: 'advisor',
            email: adv.email,
            name: adv.name,
            advisorId: adv.id,
            originalAdminEmail: adminEmail || 'admin@diu.edu.bd',
            impersonatedAt: new Date().toISOString()
        })
        toast.success(`Impersonating Advisor ${adv.name}`)
        router.push('/advisor')
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
            toast.error(getFriendlyErrorMessage(error.message))
        } else {
            toast.success('Advisor added to the system.')
            setNewName(''); setNewEmail(''); setNewPhone(''); setNewDesignation('')
            fetchAll()
        }
        setLoading(false)
    }

    async function handleDeleteAdvisor(id: string) {
        if (!confirm('Remove this advisor? Their student ID ranges will also be deleted.')) return

        await supabase.from('registrations').update({ advisor_id: null }).eq('advisor_id', id)
        await supabase.from('student_advisor_ranges').delete().eq('advisor_id', id)

        const { error } = await supabase.from('advisors').delete().eq('id', id)
        if (error) {
            toast.error(getFriendlyErrorMessage(error.message))
        } else {
            toast.success('Advisor removed successfully.')
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
            toast.error(getFriendlyErrorMessage(error.message))
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

            doc.setFillColor(15, 23, 42)
            doc.rect(0, 0, 210, 36, 'F')

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(18)
            doc.setTextColor(255, 255, 255)
            doc.text('DIU Section Pre-Registration', 14, 18)

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(11)
            doc.setTextColor(203, 213, 225)
            doc.text('Faculty Advisors Directory', 14, 26)

            doc.setFontSize(10)
            doc.setTextColor(100, 116, 139)
            doc.text(`Total Advisors: ${advisors.length}`, 14, 46)
            doc.text(`Exported: ${new Date().toLocaleString()}`, 14, 52)

            doc.setDrawColor(226, 232, 240)
            doc.line(14, 56, 196, 56)

            let y = 66
            doc.setFillColor(248, 250, 252)
            doc.rect(14, y - 6, 182, 8, 'F')
            
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            doc.setTextColor(30, 41, 59)
            doc.text('Name', 16, y - 1)
            doc.text('Email', 65, y - 1)
            doc.text('Phone', 125, y - 1)
            doc.text('Designation', 155, y - 1)

            doc.line(14, y + 2, 196, y + 2)
            y += 8

            doc.setFont('helvetica', 'normal')
            doc.setTextColor(71, 85, 105)

            advisors.forEach((adv, index) => {
                if (y > 275) {
                    doc.addPage()
                    y = 25
                    doc.setFillColor(248, 250, 252)
                    doc.rect(14, y - 6, 182, 8, 'F')
                    doc.setFont('helvetica', 'bold')
                    doc.setFontSize(9)
                    doc.setTextColor(30, 41, 59)
                    doc.text('Name', 16, y - 1)
                    doc.text('Email', 65, y - 1)
                    doc.text('Phone', 125, y - 1)
                    doc.text('Designation', 155, y - 1)
                    doc.line(14, y + 2, 196, y + 2)
                    y += 8
                    doc.setFont('helvetica', 'normal')
                    doc.setTextColor(71, 85, 105)
                }

                if (index % 2 === 1) {
                    doc.setFillColor(250, 250, 250)
                    doc.rect(14, y - 5, 182, 7, 'F')
                }

                const name = adv.name || ''
                const email = adv.email || ''
                const phone = adv.phone || '—'
                const designation = adv.designation || '—'

                doc.text(name.slice(0, 24), 16, y)
                doc.text(email.slice(0, 26), 65, y)
                doc.text(phone.slice(0, 14), 125, y)
                doc.text(designation.slice(0, 20), 155, y)

                y += 8
            })

            doc.save('registered_advisors.pdf')
            toast.success('Advisors exported to PDF.')
        } catch (err: any) {
            console.error('Error generating PDF:', err)
            toast.error('Could not generate PDF.')
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
        toast.success('Template downloaded.')
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
                toast.error('The CSV file is empty.')
                setUploading(false)
                return
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
            const nameIdx = headers.indexOf('name')
            const emailIdx = headers.indexOf('email')
            const phoneIdx = headers.indexOf('phone')
            const designationIdx = headers.indexOf('designation')

            if (nameIdx === -1 || emailIdx === -1) {
                toast.error('CSV header must contain "name" and "email" columns.')
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
                    fail++
                } else {
                    success++
                }

                setUploadCurrent(i + 1)
                setUploadProgress(Math.round(((i + 1) / rows.length) * 100))
            }

            toast.success(`Import complete: ${success} added, ${fail} failed.`)
            fetchAll()
        } catch (err: any) {
            toast.error(`Error importing CSV: ${getFriendlyErrorMessage(err.message)}`)
        } finally {
            setUploading(false)
            if (csvRef.current) csvRef.current.value = ''
        }
    }

    async function handleAddRange(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const idPattern = /^\d{3}-\d{2}-\d{3,4}$/
        if (!idPattern.test(rangeStart) || !idPattern.test(rangeEnd)) {
            toast.error('ID format must be like 241-15-001 (hyphens, no spaces)')
            setLoading(false)
            return
        }
        const { error } = await supabase.from('student_advisor_ranges').insert({
            advisor_id: rangeAdvisorId,
            start_id: rangeStart.trim(),
            end_id: rangeEnd.trim(),
        })
        if (error) {
            toast.error(getFriendlyErrorMessage(error.message))
        } else {
            toast.success('ID range assigned (universal for all semesters).')
            setRangeStart(''); setRangeEnd(''); setRangeAdvisorId('')
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <Link 
                href="/admin" 
                className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to Admin Console
            </Link>

            {/* Header */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    Faculty Roster
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Advisor Management</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                    Register faculty advisors and configure universal student ID ranges (applies across all semesters).
                </p>
            </div>

            {/* 2-Column Forms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Advisor Administration */}
                <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-primary" />
                        <div>
                            <h3 className="font-semibold text-sm text-foreground">Advisor Registration</h3>
                            <p className="text-xs text-muted-foreground">Single entry or batch upload via CSV.</p>
                        </div>
                    </div>

                    <Tabs defaultValue="single" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-muted/40 p-1 rounded-xl h-auto">
                            <TabsTrigger value="single" disabled={uploading} className="text-xs py-1.5 rounded-lg data-[state=active]:bg-card">
                                Single Advisor
                            </TabsTrigger>
                            <TabsTrigger value="bulk" disabled={uploading} className="text-xs py-1.5 rounded-lg data-[state=active]:bg-card">
                                CSV Bulk Import
                            </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="single" className="pt-3">
                            <form onSubmit={handleAddAdvisor} className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Full Name *</label>
                                    <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Dr. Abc Rahman" className="h-9 text-xs" required />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">DIU Faculty Email *</label>
                                    <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="advisor@diu.edu.bd" className="h-9 text-xs font-mono" required />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground block mb-1">Phone</label>
                                        <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="01XXXXXXXXX" className="h-9 text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground block mb-1">Designation</label>
                                        <Input value={newDesignation} onChange={e => setNewDesignation(e.target.value)} placeholder="Associate Prof." className="h-9 text-xs" />
                                    </div>
                                </div>
                                <Button type="submit" size="sm" className="w-full text-xs font-medium h-9" disabled={loading}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Advisor
                                </Button>
                            </form>
                        </TabsContent>
                        
                        <TabsContent value="bulk" className="pt-3 space-y-3">
                            {!uploading ? (
                                <div className="border border-dashed border-border/80 rounded-xl p-5 text-center space-y-2.5 bg-muted/10">
                                    <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-medium text-foreground">Upload Advisor CSV Spreadsheet</p>
                                        <p className="text-[11px] text-muted-foreground">Headers: name, email, phone, designation</p>
                                    </div>
                                    <input type="file" accept=".csv" ref={csvRef} onChange={handleCSVImport} className="hidden" />
                                    <div className="flex gap-2 justify-center pt-1">
                                        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => csvRef.current?.click()}>
                                            Choose CSV
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-xs h-8" onClick={downloadTemplate}>
                                            Download Template
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-dashed border-primary/30 rounded-xl p-5 space-y-2.5 bg-primary/5">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span className="text-primary flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                            Importing advisors...
                                        </span>
                                        <span className="text-muted-foreground font-mono">{uploadCurrent} / {uploadTotal} ({uploadProgress}%)</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="bg-primary h-full transition-all duration-200" 
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 pt-1">
                                <Button variant="outline" size="sm" className="flex-1 text-xs h-8 gap-1.5" onClick={exportCSV} disabled={uploading}>
                                    <Download className="w-3.5 h-3.5" /> Export CSV
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1 text-xs h-8 gap-1.5" onClick={exportPDF} disabled={uploading}>
                                    <FileText className="w-3.5 h-3.5" /> Export PDF
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Assign ID Range Card */}
                <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <div>
                            <h3 className="font-semibold text-sm text-foreground">Assign Student ID Range</h3>
                            <p className="text-xs text-muted-foreground">Applies universally across all semesters.</p>
                        </div>
                    </div>

                    <form onSubmit={handleAddRange} className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Select Advisor *</label>
                            <select
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium"
                                value={rangeAdvisorId}
                                onChange={e => setRangeAdvisorId(e.target.value)}
                                required
                            >
                                <option value="">Select faculty advisor</option>
                                {advisors.map(a => (
                                    <option key={a.id} value={a.id}>{a.name} — {a.email}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Start ID *</label>
                                <Input
                                    value={rangeStart}
                                    onChange={e => setRangeStart(e.target.value)}
                                    placeholder="241-15-001"
                                    className="h-9 text-xs font-mono"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">End ID *</label>
                                <Input
                                    value={rangeEnd}
                                    onChange={e => setRangeEnd(e.target.value)}
                                    placeholder="241-15-065"
                                    className="h-9 text-xs font-mono"
                                    required
                                />
                            </div>
                        </div>
                        <Button type="submit" size="sm" className="w-full text-xs font-medium h-9" disabled={loading}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Assign Range (Universal)
                        </Button>
                    </form>
                </div>
            </div>

            {/* Advisors Table */}
            <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-sm text-foreground">Registered Advisors ({advisors.length})</h3>
                        <p className="text-xs text-muted-foreground">Authorized faculty advisors for student approval.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportCSV} disabled={uploading}>
                            <Download className="h-3 w-3" /> CSV
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportPDF} disabled={uploading}>
                            <FileText className="h-3 w-3" /> PDF
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="text-xs">
                                <TableHead className="font-semibold">Faculty Name</TableHead>
                                <TableHead className="font-semibold">DIU Email</TableHead>
                                <TableHead className="font-semibold">Phone</TableHead>
                                <TableHead className="font-semibold">Designation</TableHead>
                                <TableHead className="text-right font-semibold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/60">
                            {advisors.map(a => (
                                <TableRow key={a.id} className="text-xs hover:bg-muted/30">
                                    <TableCell className="font-semibold text-foreground py-3">{a.name}</TableCell>
                                    <TableCell className="font-mono text-muted-foreground">{a.email}</TableCell>
                                    <TableCell className="text-muted-foreground">{a.phone || '—'}</TableCell>
                                    <TableCell className="text-muted-foreground">{a.designation || '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10" title="Impersonate Advisor" onClick={() => handleImpersonateAdvisor(a)}>
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(a)}>
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteAdvisor(a.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {advisors.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic text-xs">
                                        No advisors added yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Ranges Table */}
            <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20">
                    <h3 className="font-semibold text-sm text-foreground">Assigned Student ID Ranges</h3>
                    <p className="text-xs text-muted-foreground">Universal advising allocation ranges configured across all cohorts.</p>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="text-xs">
                                <TableHead className="font-semibold">Advisor</TableHead>
                                <TableHead className="font-semibold">Start ID</TableHead>
                                <TableHead className="font-semibold">End ID</TableHead>
                                <TableHead className="text-right font-semibold">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/60">
                            {ranges.map(r => (
                                <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                                    <TableCell className="font-semibold text-foreground py-3">{r.advisors?.name}</TableCell>
                                    <TableCell className="font-mono text-muted-foreground">{r.start_id}</TableCell>
                                    <TableCell className="font-mono text-muted-foreground">{r.end_id}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="icon" 
                                            variant="ghost"
                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteRange(r.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {ranges.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic text-xs">
                                        No ID ranges assigned yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Edit Advisor Dialog */}
            <Dialog open={!!editAdvisor} onOpenChange={v => !v && setEditAdvisor(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">Edit Advisor Info</DialogTitle>
                        <DialogDescription className="text-xs">
                            Update faculty details and authorized email for <span className="font-semibold text-foreground">{editAdvisor?.name}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSave} className="space-y-3 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Full Name</label>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-9 text-xs" required />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">DIU Email</label>
                            <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-9 text-xs font-mono" required />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Phone Number</label>
                            <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="h-9 text-xs" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Designation</label>
                            <Input value={editDesignation} onChange={e => setEditDesignation(e.target.value)} className="h-9 text-xs" />
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0 pt-2">
                            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setEditAdvisor(null)} disabled={loading}>
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
