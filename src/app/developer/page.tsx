'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Shield, Trash2, LogOut, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { supabase as supabaseClient } from '@/lib/supabase'

const ROLE_ORDER = ['cr', 'advisor', 'admin', 'developer']
const ROLE_COLORS: Record<string, string> = {
    developer: 'bg-purple-600',
    admin:     'bg-red-500',
    advisor:   'bg-green-600',
    cr:        'bg-blue-500',
}

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
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-extrabold flex items-center gap-3">
                        <Shield className="h-9 w-9 text-purple-600" /> Developer Console
                    </h1>
                    <p className="text-muted-foreground mt-1">Highest authority — manage all roles and access.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                    <LogOut className="h-4 w-4" /> Logout
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {ROLE_ORDER.map(role => (
                    <Card key={role}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground uppercase">{role}s</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{byRole(role).length}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Staff Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Authorized Users</CardTitle>
                    <CardDescription>
                        Promote / demote / remove users. Developer accounts are protected.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name / Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staff.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell>
                                        <div className="font-medium text-sm">{s.name || '—'}</div>
                                        <div className="text-xs text-muted-foreground">{s.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`${ROLE_COLORS[s.role] || 'bg-slate-400'} capitalize text-white`}>
                                            {s.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(s.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {s.role !== 'developer' && s.role !== 'admin' && (
                                                <Button
                                                    size="sm" variant="outline"
                                                    onClick={() => promoteRole(s.id, s.role, s.email)}
                                                    disabled={loading}
                                                    title="Promote"
                                                >
                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            {s.role !== 'developer' && s.role !== 'cr' && (
                                                <Button
                                                    size="sm" variant="outline"
                                                    onClick={() => demoteRole(s.id, s.role, s.email)}
                                                    disabled={loading}
                                                    title="Demote"
                                                >
                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            {s.role !== 'developer' && (
                                                <Button
                                                    size="sm" variant="ghost"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => removeStaff(s.id, s.role)}
                                                    disabled={loading}
                                                    title="Remove"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {staff.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                                        No staff users yet.
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
