'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, ChevronLeft, Layers } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AdminSections() {
    const [semesters, setSemesters] = useState<any[]>([])
    const [selectedSemester, setSelectedSemester] = useState<string>('')
    const [sections, setSections] = useState<any[]>([])
    const [labGroups, setLabGroups] = useState<Record<string, any[]>>({})
    const [newName, setNewName] = useState('')
    const supabase = createClient()

    useEffect(() => { fetchSemesters() }, [])
    useEffect(() => { if (selectedSemester) fetchSections(); else setSections([]) }, [selectedSemester])

    async function fetchSemesters() {
        const { data } = await supabase.from('semesters').select('*').order('created_at', { ascending: false })
        if (data) {
            setSemesters(data)
            const active = data.find(s => s.is_active)
            if (active) setSelectedSemester(active.id)
        }
    }

    async function fetchSections() {
        const { data } = await supabase
            .from('sections').select('*').eq('semester_id', selectedSemester).order('name')
        if (data) {
            setSections(data)
            // Fetch lab groups for each section
            const lgMap: Record<string, any[]> = {}
            for (const sec of data) {
                const { data: lgs } = await supabase
                    .from('lab_groups').select('*').eq('section_id', sec.id).order('name')
                lgMap[sec.id] = lgs || []
            }
            setLabGroups(lgMap)
        }
    }

    async function addSection() {
        if (!newName.trim() || !selectedSemester) { toast.error('Enter section name'); return }

        // Insert section (capacity fixed at 50)
        const { data: sec, error } = await supabase
            .from('sections')
            .insert({ name: newName.trim(), capacity: 50, semester_id: selectedSemester })
            .select().single()

        if (error) { toast.error(error.message); return }

        // Auto-create 2 lab groups: sectionName + "1" and sectionName + "2"
        const lg1 = `${newName.trim()}1`
        const lg2 = `${newName.trim()}2`
        const { error: lgErr } = await supabase.from('lab_groups').insert([
            { section_id: sec.id, name: lg1, capacity: 25 },
            { section_id: sec.id, name: lg2, capacity: 25 },
        ])

        if (lgErr) { toast.error('Section created but lab groups failed: ' + lgErr.message) }
        else { toast.success(`Section ${newName.trim()} created with lab groups ${lg1} and ${lg2}`) }

        setNewName('')
        fetchSections()
    }

    async function deleteSection(sectionId: string, sectionName: string) {
        if (!confirm(`Delete section "${sectionName}" and all its data? This cannot be undone.`)) return

        const { error } = await supabase.from('sections').delete().eq('id', sectionId)
        if (error) { toast.error(error.message) }
        else { toast.success('Section deleted.'); fetchSections() }
    }

    async function toggleSemesterActive(id: string, current: boolean) {
        if (!current) {
            // Deactivate all first (only one active at a time)
            await supabase.from('semesters').update({ is_active: false }).neq('id', id)
        }
        await supabase.from('semesters').update({ is_active: !current }).eq('id', id)
        fetchSemesters()
    }

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-8">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild><Link href="/admin"><ChevronLeft className="h-4 w-4" />Back</Link></Button>
                <h1 className="text-3xl font-bold">Section Management</h1>
            </div>

            {/* Semester selector */}
            <Card>
                <CardHeader><CardTitle className="flex gap-2 items-center"><Layers className="h-5 w-5" /> Select Semester</CardTitle></CardHeader>
                <CardContent>
                    <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                        <SelectTrigger><SelectValue placeholder="Choose a semester" /></SelectTrigger>
                        <SelectContent>
                            {semesters.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.name}{s.is_active ? ' (Active)' : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedSemester && (
                <>
                    {/* Add Section */}
                    <Card>
                        <CardHeader><CardTitle>Create New Section</CardTitle></CardHeader>
                        <CardContent className="flex gap-4">
                            <Input
                                placeholder="Section Name (e.g. 66_A)"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addSection()}
                                className="flex-1"
                            />
                            <Button onClick={addSection}><Plus className="h-4 w-4 mr-1" /> Add Section</Button>
                        </CardContent>
                    </Card>

                    {/* Sections Table */}
                    <Card>
                        <CardHeader><CardTitle>Sections ({sections.length})</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Section</TableHead>
                                        <TableHead>Lab Groups</TableHead>
                                        <TableHead>Capacity</TableHead>
                                        <TableHead className="text-right">Delete</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sections.map(sec => (
                                        <TableRow key={sec.id}>
                                            <TableCell className="font-semibold">{sec.name}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {(labGroups[sec.id] || []).map(lg => (
                                                        <Badge key={lg.id} variant="outline" className="text-xs">
                                                            {lg.name} ({lg.capacity} seats)
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell>{sec.capacity} seats</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm" variant="ghost"
                                                    className="text-destructive"
                                                    onClick={() => deleteSection(sec.id, sec.name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {sections.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">
                                                No sections yet. Add one above.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
