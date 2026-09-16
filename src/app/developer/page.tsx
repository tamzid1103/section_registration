'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Shield, Trash2, LogOut, ArrowUp, ArrowDown, Code2, Sparkles, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { supabase as supabaseClient } from '@/lib/supabase'

const ROLE_ORDER = ['cr', 'advisor', 'admin', 'developer']

export default function DeveloperConsolePage() {
    const [staff, setStaff] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => { fetchStaff() }, [])

    async function fetchStaff() {
        const { data } = await supabase
            .from('authorized_staff')
            .select('*')
            .order('role', { ascending: true })
        if (data) setStaff(data)
    }

    async function promoteRole(id: string, currentRole: string, email: string) {
        const idx = ROLE_ORDER.indexOf(currentRole)
        if (idx >= ROLE_ORDER.length - 1) {
            toast.error('Already at highest role.')
            return
        }
        if (currentRole === 'admin') {
            toast.error('Developers cannot be created via this panel.')
            return
        }
        const nextRole = ROLE_ORDER[idx + 1]
        setLoading(true)
        const { error } = await supabase.from('authorized_staff').update({ role: nextRole }).eq('id', id)
        if (error) { toast.error(error.message) }
        else { toast.success(`${email} promoted to ${nextRole.toUpperCase()}`) }
        fetchStaff()
        setLoading(false)
    }

    async function demoteRole(id: string, currentRole: string, email: string) {
        if (currentRole === 'developer') {
            toast.error('Developer accounts cannot be demoted from this panel.')
            return
        }
        const idx = ROLE_ORDER.indexOf(currentRole)
        if (idx <= 0) {
            toast.error('Already at lowest role.')
            return
        }
        const prevRole = ROLE_ORDER[idx - 1]
        setLoading(true)
        const { error } = await supabase.from('authorized_staff').update({ role: prevRole }).eq('id', id)
        if (error) { toast.error(error.message) }
        else { toast.success(`${email} demoted to ${prevRole.toUpperCase()}`) }
        fetchStaff()
        setLoading(false)
    }

    async function removeStaff(id: string, role: string) {
        if (role === 'developer') {
            toast.error('Developer accounts cannot be removed here.')
            return
        }
        if (!confirm('Remove this user from the system entirely?')) return
        setLoading(true)
        const { error } = await supabase.from('authorized_staff').delete().eq('id', id)
        if (error) { toast.error(error.message) }
        else { toast.success('User removed.') }
        fetchStaff()
        setLoading(false)
    }

    async function handleLogout() {
        await supabaseClient.auth.signOut()
        router.push('/auth/login')
    }

    const byRole = (r: string) => staff.filter(s => s.role === r)

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            {/* Header */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Code2 className="w-3 h-3" /> System Operations
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Developer Root Console</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Global role orchestration and administrative hierarchy management.
                    </p>
                </div>

                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-muted-foreground hover:text-foreground">
                    <LogOut className="h-3.5 w-3.5 mr-1" /> Logout
                </Button>
            </div>

            {/* Role Stat KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {ROLE_ORDER.map(role => (
                    <div key={role} className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-xs font-semibold uppercase tracking-wider">{role}s</span>
                            <UserCheck className="h-3.5 w-3.5" />
                        </div>
                        <div className="mt-2">
                            <div className="text-2xl font-bold text-foreground">{byRole(role).length}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Active accounts</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Staff Table */}
            <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20">
                    <h3 className="font-semibold text-sm text-foreground">Authorized System Users</h3>
                    <p className="text-xs text-muted-foreground">Promote, demote, or revoke user privileges.</p>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="text-xs">
                                <TableHead className="font-semibold">User Details</TableHead>
                                <TableHead className="font-semibold">Role Tier</TableHead>
                                <TableHead className="font-semibold">Registered</TableHead>
                                <TableHead className="text-right font-semibold">Hierarchy Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/60">
                            {staff.map((s) => (
                                <TableRow key={s.id} className="text-xs hover:bg-muted/30">
                                    <TableCell className="py-3">
                                        <div className="font-semibold text-foreground">{s.name || '—'}</div>
                                        <div className="font-mono text-[11px] text-muted-foreground">{s.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge 
                                            variant="outline" 
                                            className={`text-[9px] font-bold uppercase ${
                                                s.role === 'developer' 
                                                    ? 'border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10'
                                                    : s.role === 'admin'
                                                    ? 'border-destructive/40 text-destructive bg-destructive/10'
                                                    : 'border-primary/40 text-primary bg-primary/10'
                                            }`}
                                        >
                                            {s.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-[11px] text-muted-foreground font-mono">
                                        {new Date(s.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {s.role !== 'developer' && s.role !== 'admin' && (
                                                <Button
                                                    size="icon" 
                                                    variant="outline"
                                                    className="h-7 w-7 text-xs"
                                                    onClick={() => promoteRole(s.id, s.role, s.email)}
                                                    disabled={loading}
                                                    title="Promote Role"
                                                >
                                                    <ArrowUp className="h-3 w-3" />
                                                </Button>
                                            )}
                                            {s.role !== 'developer' && s.role !== 'cr' && (
                                                <Button
                                                    size="icon" 
                                                    variant="outline"
                                                    className="h-7 w-7 text-xs"
                                                    onClick={() => demoteRole(s.id, s.role, s.email)}
                                                    disabled={loading}
                                                    title="Demote Role"
                                                >
                                                    <ArrowDown className="h-3 w-3" />
                                                </Button>
                                            )}
                                            {s.role !== 'developer' && (
                                                <Button
                                                    size="icon" 
                                                    variant="ghost"
                                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                    onClick={() => removeStaff(s.id, s.role)}
                                                    disabled={loading}
                                                    title="Revoke Access"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {staff.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic text-xs">
                                        No authorized staff users found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
