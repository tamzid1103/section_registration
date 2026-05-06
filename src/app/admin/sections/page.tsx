'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Layers } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminSections() {
    const [semesters, setSemesters] = useState<any[]>([])
    const [selectedSemester, setSelectedSemester] = useState<string>('')
    const [sections, setSections] = useState<any[]>([])
    const [newName, setNewName] = useState('')
    const [maxSeats, setMaxSeats] = useState('30')

    const supabase = createClient()

    useEffect(() => {
        fetchSemesters()
    }, [])

    useEffect(() => {
        if (selectedSemester) {
            fetchSections()
        } else {
            setSections([])
        }
    }, [selectedSemester])

    async function fetchSemesters() {
        const { data } = await supabase.from('semesters').select('*').order('created_at', { ascending: false })
        if (data) {
            setSemesters(data)
            // Auto-select active semester if exists
            const active = data.find(s => s.is_active)
            if (active) setSelectedSemester(active.id)
        }
    }

    async function fetchSections() {
        const { data } = await supabase.from('sections').select('*').eq('semester_id', selectedSemester).order('name', { ascending: true })
        if (data) setSections(data)
    }

    async function addSection() {
        if (!newName || !selectedSemester) return
        const { error } = await supabase.from('sections').insert({
            name: newName,
            max_seats: parseInt(maxSeats),
            semester_id: selectedSemester
        })

        if (error) {
            toast.error(error.message)
        } else {
            setNewName('')
            fetchSections()
            toast.success("Section added")
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-8">
            <h1 className="text-3xl font-bold">Section Management</h1>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" /> Select Semester
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choose a semester to manage sections" />
                        </SelectTrigger>
                        <SelectContent>
                            {semesters.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.name} {s.is_active && '(Active)'}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedSemester && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New Section</CardTitle>
                        </CardHeader>
                        <CardContent className="flex gap-4">
                            <Input
                                placeholder="Section Name (e.g., A, B, C)"
                                value={newName}
                                className="flex-1"
                                onChange={(e) => setNewName(e.target.value)}
                            />
                            <Input
                                type="number"
                                placeholder="Max Seats"
                                value={maxSeats}
                                className="w-24"
                                onChange={(e) => setMaxSeats(e.target.value)}
                            />
                            <Button onClick={addSection}>
                                <Plus className="mr-2 h-4 w-4" /> Add
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Section Name</TableHead>
                                    <TableHead>Current Seats</TableHead>
                                    <TableHead>Max Seats</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sections.map((sec) => (
                                    <TableRow key={sec.id}>
                                        <TableCell className="font-medium">{sec.name}</TableCell>
                                        <TableCell>{sec.current_seats}</TableCell>
                                        <TableCell>{sec.max_seats}</TableCell>
                                    </TableRow>
                                ))}
                                {sections.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                            No sections created for this semester
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </>
            )}
        </div>
    )
}
