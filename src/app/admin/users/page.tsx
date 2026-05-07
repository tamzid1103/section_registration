'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Check, X, ShieldCheck, Mail, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminUsers() {
    const [applications, setApplications] = useState<any[]>([])
    const [staff, setStaff] = useState<any[]>([])
    const supabase = createClient()

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        const { data: apps } = await supabase.from('cr_applications').select('*').eq('status', 'pending')
        const { data: s } = await supabase.from('authorized_staff').select('*').order('role', { ascending: true })
        if (apps) setApplications(apps)
        if (s) {
            // Fetch section info for each CR
            const staffWithSections = await Promise.all(
                s.map(async (staff) => {
                    if (staff.role === 'cr') {
                        const { data: app } = await supabase.from('cr_applications').select('section_interested').eq('email', staff.email).eq('status', 'approved').maybeSingle()
                        return { ...staff, section_interested: app?.section_interested || 'N/A' }
                    }
                    return staff
                })
            )
            setStaff(staffWithSections)
        }
    }

    async function handleApprove(app: any) {
        // 1. Add to staff
        const { error: staffError } = await supabase.from('authorized_staff').insert({
            email: app.email,
            name: app.full_name,
            role: 'cr'
        })

        if (staffError) {
            toast.error("Failed to add staff: " + staffError.message)
            return
        }

        // 2. Update application
        await supabase.from('cr_applications').update({ status: 'approved' }).eq('id', app.id)

        toast.success("CR Approved")
        fetchData()
    }

    async function handleReject(appId: string) {
        await supabase.from('cr_applications').update({ status: 'rejected' }).eq('id', appId)
        toast.info("Application rejected")
        fetchData()
    }

    async function handlePromoteToAdmin(staffId: string) {
        const { error } = await supabase
            .from('authorized_staff')
            .update({ role: 'admin' })
            .eq('id', staffId)

        if (error) {
            toast.error(error.message)
            return
        }

        toast.success('Promoted to Admin')
        fetchData()
    }

    return (
        <div className="container mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold">User Management</h1>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Pending CR Applications */}
                <Card>
                    <CardHeader>
                        <CardTitle>Pending CR Applications</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {applications.map((app) => (
                                    <TableRow key={app.id}>
                                        <TableCell>
                                            <div className="font-medium text-sm">{app.full_name}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Mail className="h-3 w-3" /> {app.email}
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{app.section_interested}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" variant="outline" onClick={() => handleApprove(app)}>
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleReject(app.id)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {applications.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">
                                            No pending applications
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Existing Authorized Staff */}
                <Card>
                    <CardHeader>
                        <CardTitle>Authorized Access</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {staff.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="text-xs">{s.email}</TableCell>
                                        <TableCell>
                                            <Badge className={s.role === 'admin' ? "bg-red-500" : s.role === 'developer' ? "bg-purple-500" : "bg-blue-500"}>
                                                {s.role.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {s.role === 'cr' ? (
                                                <Badge variant="outline">{s.section_interested}</Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {s.role === 'cr' ? (
                                                <Button size="sm" variant="outline" onClick={() => handlePromoteToAdmin(s.id)}>
                                                    <ArrowUpRight className="h-4 w-4 mr-1" /> Promote
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">No actions</span>
                                            )}
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
