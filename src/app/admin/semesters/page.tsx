'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Plus, Check, X } from 'lucide-react'
import { invalidateCacheScopes } from '@/lib/cache/client'

export default function AdminSemesters() {
    const [semesters, setSemesters] = useState<any[]>([])
    const [newName, setNewName] = useState('')
    const supabase = createClient()

    useEffect(() => {
        fetchSemesters()
    }, [])

    async function fetchSemesters() {
        const { data } = await supabase.from('semesters').select('*').order('created_at', { ascending: false })
        if (data) setSemesters(data)
    }

    async function addSemester() {
        if (!newName) return
        const { error } = await supabase.from('semesters').insert({ name: newName })
        if (!error) {
            await invalidateCacheScopes(['home', 'admin'])
            setNewName('')
            fetchSemesters()
        }
    }

    async function toggleActive(id: string, currentStatus: boolean) {
        // Disable all first if we're enabling one (only one active at a time)
        if (!currentStatus) {
            await supabase.from('semesters').update({ is_active: false }).neq('id', id)
        }

        const { error } = await supabase
            .from('semesters')
            .update({ is_active: !currentStatus })
            .eq('id', id)

        if (!error) {
            await invalidateCacheScopes(['home', 'admin'])
            fetchSemesters()
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8">Semester Management</h1>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Create New Semester</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Input
                        placeholder="e.g., Spring 2024"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <Button onClick={addSemester}>
                        <Plus className="mr-2 h-4 w-4" /> Add
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {semesters.map((s) => (
                            <TableRow key={s.id}>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell>
                                    {s.is_active ? (
                                        <Badge variant="default" className="bg-green-500">Active</Badge>
                                    ) : (
                                        <Badge variant="secondary">Closed</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span className="text-sm text-muted-foreground">
                                            {s.is_active ? 'Active' : 'Dormant'}
                                        </span>
                                        <Switch
                                            checked={s.is_active}
                                            onCheckedChange={() => toggleActive(s.id, s.is_active)}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    )
}
