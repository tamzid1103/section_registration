'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, ArrowLeft, Layers, Settings, Users, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { getFriendlyErrorMessage } from '@/lib/utils'
import Link from 'next/link'
import { invalidateCacheScopes } from '@/lib/cache/client'

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

        const { data: sec, error } = await supabase
            .from('sections')
            .insert({ name: newName.trim(), capacity: 50, semester_id: selectedSemester })
            .select().single()

        if (error) { toast.error(getFriendlyErrorMessage(error.message)); return }

        const lg1 = `${newName.trim()}1`
        const lg2 = `${newName.trim()}2`
        const { error: lgErr } = await supabase.from('lab_groups').insert([
            { section_id: sec.id, name: lg1, capacity: 25 },
            { section_id: sec.id, name: lg2, capacity: 25 },
        ])

        if (lgErr) { toast.error('Section created but lab groups failed: ' + getFriendlyErrorMessage(lgErr.message)) }
        else { toast.success(`Section ${newName.trim()} created with lab groups ${lg1} and ${lg2}`) }

        await invalidateCacheScopes(['home', 'admin'])
        setNewName('')
        fetchSections()
    }

    async function deleteSection(sectionId: string, sectionName: string) {
        if (!confirm(`Delete section "${sectionName}" and all its data? This cannot be undone.`)) return

        await supabase.from('registrations').delete().eq('section_id', sectionId)
        const { error } = await supabase.from('sections').delete().eq('id', sectionId)
        if (error) { toast.error(getFriendlyErrorMessage(error.message)) }
        else {
            toast.success('Section deleted.')
            await invalidateCacheScopes(['home', 'admin'])
            fetchSections()
        }
    }

    const currentSem = semesters.find(s => s.id === selectedSemester)

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <Link 
                href="/admin" 
                className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to Admin Console
            </Link>

            {/* Header */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                            Curriculum &amp; Cohorts
                        </span>
                        {currentSem && (
                            <Badge variant={currentSem.is_active ? 'default' : 'outline'} className="text-xs">
                                {currentSem.name}
                            </Badge>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Section &amp; Lab Management</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Create sections (50 capacity) and automatic 25-seat lab group sub-divisions.
                    </p>
                </div>

                <div className="flex items-center gap-2 min-w-[200px]">
                    <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Select semester..." />
                        </SelectTrigger>
                        <SelectContent>
                            {semesters.map(s => (
                                <SelectItem key={s.id} value={s.id} className="text-xs">
                                    {s.name} {s.is_active ? '• Live' : '• Archived'}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {selectedSemester && (
                <>
                    {/* Add Section Card */}
                    <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3">
                        <h3 className="font-semibold text-sm text-foreground">Create New Section</h3>
                        <div className="flex flex-col sm:flex-row gap-2.5">
                            <Input
                                placeholder="Section Name (e.g. 66_E or 67_A)"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addSection()}
                                className="h-9 text-xs"
                            />
                            <Button onClick={addSection} size="sm" className="h-9 text-xs shrink-0 font-medium">
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add Section (50 Seats)
                            </Button>
                        </div>
                    </div>

                    {/* Sections Table Card */}
                    <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">Configured Sections</h3>
                                <p className="text-xs text-muted-foreground">{sections.length} active section cohorts in {currentSem?.name}.</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="text-xs">
                                        <TableHead className="font-semibold">Section</TableHead>
                                        <TableHead className="font-semibold">Lab Groups (25/each)</TableHead>
                                        <TableHead className="font-semibold">Total Capacity</TableHead>
                                        <TableHead className="text-right font-semibold">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-border/60">
                                    {sections.map(sec => (
                                        <TableRow key={sec.id} className="text-xs hover:bg-muted/30">
                                            <TableCell className="font-bold text-foreground py-3">
                                                Section {sec.name}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {(labGroups[sec.id] || []).map(lg => (
                                                        <Badge key={lg.id} variant="outline" className="text-[10px] font-mono bg-muted/40">
                                                            {lg.name} ({lg.capacity} seats)
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-muted-foreground">
                                                {sec.capacity} seats
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="icon" 
                                                    variant="ghost"
                                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                    onClick={() => deleteSection(sec.id, sec.name)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {sections.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic text-xs">
                                                No sections configured for this semester yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
