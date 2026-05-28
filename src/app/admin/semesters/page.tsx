'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Plus, Lock, Unlock } from 'lucide-react'
import { invalidateCacheScopes } from '@/lib/cache/client'

type SemesterRow = {
    id: string
    name: string
    is_active: boolean
    is_locked: boolean
    locked_at: string | null
    created_at: string
}

const DHAKA_OFFSET = '+06:00'

function toDhakaInputValue(isoValue: string | null) {
    if (!isoValue) return ''
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date(isoValue))

    const get = (type: string) => parts.find((part) => part.type === type)?.value || '00'
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function fromDhakaInputValue(inputValue: string) {
    if (!inputValue) return null
    return new Date(`${inputValue}:00${DHAKA_OFFSET}`).toISOString()
}


export default function AdminSemesters() {
    const [semesters, setSemesters] = useState<SemesterRow[]>([])
    const [newName, setNewName] = useState('')
    const [timerEnabled, setTimerEnabled] = useState(false)
    const [timerStart, setTimerStart] = useState('')
    const [timerEnd, setTimerEnd] = useState('')
    const supabase = createClient()
    const [actionStatuses, setActionStatuses] = useState<Record<string, { message: string; type: 'success' | 'error' | 'info' } | undefined>>({})
    const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({})
    const [timerSaveStatus, setTimerSaveStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
    const [globalBusy, setGlobalBusy] = useState(false)

    useEffect(() => {
        fetchSemesters()
        fetchTimerSettings()
    }, [])

    async function fetchSemesters() {
        const { data } = await supabase.from('semesters').select('*').order('created_at', { ascending: false })
        if (data) {
            setSemesters((data || []) as SemesterRow[])
        }
    }

    async function fetchTimerSettings() {
        const { data } = await supabase
            .from('system_settings')
            .select('timer_enabled, registration_start_at, registration_end_at')
            .eq('id', 1)
            .maybeSingle()

        if (!data) return

        setTimerEnabled(Boolean(data.timer_enabled))
        setTimerStart(toDhakaInputValue(data.registration_start_at))
        setTimerEnd(toDhakaInputValue(data.registration_end_at))
    }

    async function addSemester() {
        if (!newName) return
        setGlobalBusy(true)
        setTimerSaveStatus({ message: 'Creating semester...', type: 'success' })
        try {
            const { error } = await supabase.from('semesters').insert({ name: newName })
            if (error) throw error
            await invalidateCacheScopes(['home', 'admin'])
            setNewName('')
            fetchSemesters()
            setTimerSaveStatus({ message: 'Semester created', type: 'success' })
        } catch (err: any) {
            setTimerSaveStatus({ message: err?.message || 'Failed to create semester', type: 'error' })
        } finally {
            setGlobalBusy(false)
            setTimeout(() => setTimerSaveStatus(null), 3500)
        }
    }

    async function toggleActive(id: string, currentStatus: boolean) {
        setActionBusy((s) => ({ ...s, [id]: true }))
        setActionStatuses((s) => ({ ...s, [id]: { message: 'Updating status...', type: 'info' } }))
        try {
            if (!currentStatus) {
                await supabase.from('semesters').update({ is_active: false }).neq('id', id)
            }
            const { error } = await supabase
                .from('semesters')
                .update({ is_active: !currentStatus })
                .eq('id', id)
            if (error) throw error
            await invalidateCacheScopes(['home', 'admin'])
            fetchSemesters()
            setActionStatuses((s) => ({ ...s, [id]: { message: 'Status updated', type: 'success' } }))
        } catch (err: any) {
            setActionStatuses((s) => ({ ...s, [id]: { message: err?.message || 'Failed to update', type: 'error' } }))
        } finally {
            setActionBusy((s) => ({ ...s, [id]: false }))
            setTimeout(() => setActionStatuses((s) => { const n = { ...s }; delete n[id]; return n }), 3500)
        }
    }

    async function toggleLock(id: string, currentStatus: boolean) {
        setActionBusy((s) => ({ ...s, [id]: true }))
        setActionStatuses((s) => ({ ...s, [id]: { message: currentStatus ? 'Unlocking...' : 'Locking...', type: 'info' } }))
        try {
            const payload = {
                is_locked: !currentStatus,
                locked_at: !currentStatus ? new Date().toISOString() : null,
            }
            const { error } = await supabase
                .from('semesters')
                .update(payload)
                .eq('id', id)
            if (error) throw error
            await invalidateCacheScopes(['home', 'admin'])
            fetchSemesters()
            setActionStatuses((s) => ({ ...s, [id]: { message: currentStatus ? 'Unlocked' : 'Locked', type: 'success' } }))
        } catch (err: any) {
            setActionStatuses((s) => ({ ...s, [id]: { message: err?.message || 'Failed to update lock', type: 'error' } }))
        } finally {
            setActionBusy((s) => ({ ...s, [id]: false }))
            setTimeout(() => setActionStatuses((s) => { const n = { ...s }; delete n[id]; return n }), 3500)
        }
    }



    async function saveTimerSettings() {
        const startIso = fromDhakaInputValue(timerStart)
        const endIso = fromDhakaInputValue(timerEnd)

        if (timerEnabled && (!startIso || !endIso)) {
            setTimerSaveStatus({ message: 'Start and end required', type: 'error' })
            setTimeout(() => setTimerSaveStatus(null), 3500)
            return
        }

        if (startIso && endIso && new Date(startIso).getTime() >= new Date(endIso).getTime()) {
            setTimerSaveStatus({ message: 'Start must be before end', type: 'error' })
            setTimeout(() => setTimerSaveStatus(null), 3500)
            return
        }

        setGlobalBusy(true)
        setTimerSaveStatus({ message: 'Saving...', type: 'info' })
        try {
            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    id: 1,
                    timer_enabled: timerEnabled,
                    registration_start_at: startIso,
                    registration_end_at: endIso,
                    timezone: 'Asia/Dhaka',
                    updated_at: new Date().toISOString(),
                })
            if (error) throw error
            await invalidateCacheScopes(['home', 'admin'])
            fetchTimerSettings()
            setTimerSaveStatus({ message: 'Saved', type: 'success' })
        } catch (err: any) {
            setTimerSaveStatus({ message: err?.message || 'Failed to save', type: 'error' })
        } finally {
            setGlobalBusy(false)
            setTimeout(() => setTimerSaveStatus(null), 3500)
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

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Registration Reminder Timer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <p className="font-medium">Enable Reminder Timer</p>
                            <p className="text-sm text-muted-foreground">Controls home page countdown/clock behavior.</p>
                        </div>
                        <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Start Date & Time</p>
                            <Input type="datetime-local" value={timerStart} onChange={(e) => setTimerStart(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">End Date & Time</p>
                            <Input type="datetime-local" value={timerEnd} onChange={(e) => setTimerEnd(e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <Button onClick={saveTimerSettings} disabled={globalBusy}>{globalBusy ? 'Saving…' : 'Save Reminder Settings'}</Button>
                        {timerSaveStatus ? (
                            <div className={`mt-2 text-sm ${timerSaveStatus.type === 'error' ? 'text-destructive' : 'text-success'}`}>{timerSaveStatus.message}</div>
                        ) : null}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Lock</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
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
                                <TableCell>
                                    {s.is_locked ? (
                                        <Badge variant="destructive" className="px-3 py-1">Locked</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="px-3 py-1">Unlocked</Badge>
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
                                            disabled={!!actionBusy[s.id]}
                                        />
                                        <Button
                                            size="sm"
                                            variant={s.is_locked ? 'outline' : 'destructive'}
                                            onClick={() => toggleLock(s.id, s.is_locked)}
                                            disabled={!!actionBusy[s.id]}
                                        >
                                            {actionBusy[s.id] ? (s.is_locked ? 'Unlocking…' : 'Locking…') : (s.is_locked ? <><Unlock className="mr-1 h-3.5 w-3.5" /> Unlock</> : <><Lock className="mr-1 h-3.5 w-3.5" /> Lock</>)}
                                        </Button>
                                    </div>
                                    {(() => { const st = actionStatuses[s.id]; return st ? (
                                        <div className={`mt-2 text-xs ${st.type === 'error' ? 'text-destructive' : st.type === 'success' ? 'text-success' : 'text-muted-foreground'}`}>
                                            {st.message}
                                        </div>
                                    ) : null })()} 
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    )
}
