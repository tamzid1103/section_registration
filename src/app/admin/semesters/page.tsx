'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Plus, Lock, Unlock, ArrowLeft, Calendar, Timer, Check, AlertCircle } from 'lucide-react'
import { invalidateCacheScopes } from '@/lib/cache/client'
import Link from 'next/link'

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
        const res = await fetch('/api/admin/timer-settings', { cache: 'no-store' })
        if (!res.ok) return
        const { data } = await res.json()
        if (!data) return
        setTimerEnabled(Boolean(data.timer_enabled))
        setTimerStart(toDhakaInputValue(data.registration_start_at))
        setTimerEnd(toDhakaInputValue(data.registration_end_at))
    }

    async function addSemester() {
        if (!newName.trim()) return
        setGlobalBusy(true)
        setTimerSaveStatus({ message: 'Creating semester...', type: 'info' })
        try {
            const { error } = await supabase.from('semesters').insert({ name: newName.trim() })
            if (error) throw error
            await invalidateCacheScopes(['home', 'admin'])
            setNewName('')
            fetchSemesters()
            setTimerSaveStatus({ message: 'Semester created successfully', type: 'success' })
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
            setTimerSaveStatus({ message: 'Start and end time required', type: 'error' })
            setTimeout(() => setTimerSaveStatus(null), 3500)
            return
        }

        if (startIso && endIso && new Date(startIso).getTime() >= new Date(endIso).getTime()) {
            setTimerSaveStatus({ message: 'Start time must be before end time', type: 'error' })
            setTimeout(() => setTimerSaveStatus(null), 3500)
            return
        }

        setGlobalBusy(true)
        setTimerSaveStatus({ message: 'Saving reminder settings...', type: 'info' })
        try {
            const res = await fetch('/api/admin/timer-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timer_enabled: timerEnabled,
                    registration_start_at: startIso,
                    registration_end_at: endIso,
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to save')
            await invalidateCacheScopes(['home', 'admin'])
            await fetchTimerSettings()
            setTimerSaveStatus({ message: 'Timer settings saved successfully', type: 'success' })
        } catch (err: any) {
            setTimerSaveStatus({ message: err?.message || 'Failed to save', type: 'error' })
        } finally {
            setGlobalBusy(false)
            setTimeout(() => setTimerSaveStatus(null), 3500)
        }
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
                    Academic Cycle
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Semester Management</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                    Activate academic terms, configure countdown timer reminders, and toggle enrollment write-locks.
                </p>
            </div>

            {/* Create New Semester */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Create New Semester Term</h3>
                <div className="flex flex-col sm:flex-row gap-2.5">
                    <Input
                        placeholder="e.g. Spring 2025 or Fall 2024"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addSemester()}
                        className="h-9 text-xs"
                    />
                    <Button onClick={addSemester} disabled={globalBusy} size="sm" className="h-9 text-xs shrink-0 font-medium">
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Semester
                    </Button>
                </div>
            </div>

            {/* Countdown / Reminder Timer */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-primary" />
                        <div>
                            <h3 className="font-semibold text-sm text-foreground">Registration Countdown Reminder</h3>
                            <p className="text-xs text-muted-foreground">Display live countdown widget on student portal header.</p>
                        </div>
                    </div>
                    <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Start Date &amp; Time (Dhaka BST)</label>
                        <Input type="datetime-local" value={timerStart} onChange={(e) => setTimerStart(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">End Date &amp; Time (Dhaka BST)</label>
                        <Input type="datetime-local" value={timerEnd} onChange={(e) => setTimerEnd(e.target.value)} className="h-9 text-xs" />
                    </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                    <Button onClick={saveTimerSettings} disabled={globalBusy} size="sm" className="text-xs font-medium">
                        {globalBusy ? 'Saving…' : 'Save Timer Settings'}
                    </Button>
                    {timerSaveStatus && (
                        <span className={`text-xs ${timerSaveStatus.type === 'error' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {timerSaveStatus.message}
                        </span>
                    )}
                </div>
            </div>

            {/* Semesters List Table */}
            <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20">
                    <h3 className="font-semibold text-sm text-foreground">All Semesters ({semesters.length})</h3>
                    <p className="text-xs text-muted-foreground">Toggle active status and enrollment lock states.</p>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="text-xs">
                                <TableHead className="font-semibold">Semester Term</TableHead>
                                <TableHead className="font-semibold">Active Status</TableHead>
                                <TableHead className="font-semibold">Write Lock</TableHead>
                                <TableHead className="text-right font-semibold">Controls</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/60">
                            {semesters.map((s) => (
                                <TableRow key={s.id} className="text-xs hover:bg-muted/30">
                                    <TableCell className="font-semibold text-foreground py-3">
                                        {s.name}
                                    </TableCell>
                                    <TableCell>
                                        {s.is_active ? (
                                            <Badge variant="default" className="text-[10px] bg-emerald-600 text-white">
                                                Active Live
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                Archived
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {s.is_locked ? (
                                            <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive bg-destructive/10">
                                                Locked
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                                                Open
                                            </Badge>
                                        )}
                                    </TableCell>

                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] text-muted-foreground">
                                                    {s.is_active ? 'Active' : 'Dormant'}
                                                </span>
                                                <Switch
                                                    checked={s.is_active}
                                                    onCheckedChange={() => toggleActive(s.id, s.is_active)}
                                                    disabled={!!actionBusy[s.id]}
                                                />
                                            </div>
                                            <Button
                                                size="sm"
                                                variant={s.is_locked ? 'outline' : 'destructive'}
                                                className="h-7 text-xs"
                                                onClick={() => toggleLock(s.id, s.is_locked)}
                                                disabled={!!actionBusy[s.id]}
                                            >
                                                {actionBusy[s.id] ? (
                                                    'Updating…'
                                                ) : s.is_locked ? (
                                                    <><Unlock className="mr-1 h-3 w-3" /> Unlock</>
                                                ) : (
                                                    <><Lock className="mr-1 h-3 w-3" /> Lock</>
                                                )}
                                            </Button>
                                        </div>
                                        {(() => { 
                                            const st = actionStatuses[s.id]
                                            return st ? (
                                                <div className={`mt-1.5 text-[10px] ${st.type === 'error' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {st.message}
                                                </div>
                                            ) : null 
                                        })()} 
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
