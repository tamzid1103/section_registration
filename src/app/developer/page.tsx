'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Shield, Trash2, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'

export default function DeveloperUsersPage() {
    const [staff, setStaff] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        fetchStaff()
    }, [])

    async function fetchStaff() {
        const { data } = await supabase
            .from('authorized_staff')
            .select('*')
            .order('role', { ascending: true })
        if (data) setStaff(data)
    }

    async function updateRole(id: string, currentRole: string) {
        setLoading(true)
        const nextRole = currentRole === 'cr' ? 'admin' : 'cr'

        const { error } = await supabase
            .from('authorized_staff')
            .update({ role: nextRole })
            .eq('id', id)

        if (error) {
            toast.error(error.message)
        } else {
            toast.success(`User updated to ${nextRole.toUpperCase()}`)
            fetchStaff()
        }
        setLoading(false)
    }

    async function removeStaff(id: string, role: string) {
        if (role === 'developer') {
            toast.error("Developers cannot be removed here")
            return
        }

        const { error } = await supabase.from('authorized_staff').delete().eq('id', id)
        if (error) {
            toast.error(error.message)
        } else {
            toast.success("User removed")
            fetchStaff()
        }
    }

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-extrabold flex items-center gap-3">
                        <Shield className="h-10 w-10 text-primary" /> Developer Console
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage System-Wide Roles & Authority</p>
                </div>
            </div>

            <div className="grid md:grid-cols-1 gap-8">
                {/* Authority Management */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Staff Authority Table</CardTitle>
                        <CardDescription>Promote CRs, demote Admins, and remove CR/Admin accounts.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User Email</TableHead>
                                    <TableHead>Current Role</TableHead>
                                    <TableHead className="text-right">Manage Role</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {staff.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium text-sm">{s.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={s.role === 'developer' ? 'destructive' : 'default'} className="capitalize">
                                                {s.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {s.role === 'cr' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateRole(s.id, s.role)}
                                                        disabled={loading}
                                                    >
                                                        <ArrowUpDown className="h-4 w-4 mr-2" />
                                                        Make Admin
                                                    </Button>
                                                )}
                                                {s.role === 'admin' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateRole(s.id, s.role)}
                                                        disabled={loading}
                                                    >
                                                        <ArrowUpDown className="h-4 w-4 mr-2" />
                                                        Demote to CR
                                                    </Button>
                                                )}
                                                {(s.role === 'admin' || s.role === 'cr') && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-destructive"
                                                        onClick={() => removeStaff(s.id, s.role)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
