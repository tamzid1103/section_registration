'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { UserPlus, Trash2, ChevronLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AdminAdvisorsPage() {
    const [advisors, setAdvisors] = useState<any[]>([])
    const [semesters, setSemesters] = useState<any[]>([])
    const [ranges, setRanges] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

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
                {/* Add New Advisor */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex gap-2 items-center">
                            <UserPlus className="h-5 w-5" /> Add Advisor to System
                        </CardTitle>
                        <CardDescription>
                            Once an advisor&apos;s email is added here, they can register and get auto-approved.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
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
                <CardHeader>
                    <CardTitle>Registered Advisors ({advisors.length})</CardTitle>
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
                                        <Button
                                            size="sm" variant="ghost"
                                            className="text-destructive"
                                            onClick={() => handleDeleteAdvisor(a.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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
        </div>
    )
}
