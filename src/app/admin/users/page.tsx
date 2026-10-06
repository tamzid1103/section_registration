'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Check, X, ShieldCheck, Mail, ArrowUpRight, Trash2, UserMinus, ArrowLeft, Users, Bell, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { getFriendlyErrorMessage } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { startImpersonation } from '@/lib/impersonation'
import Link from 'next/link'

export default function AdminUsers() {
    const [applications, setApplications] = useState<any[]>([])
    const [staff, setStaff] = useState<any[]>([])
    const [adminEmail, setAdminEmail] = useState<string>('')
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) setAdminEmail(user.email)

        const { data: apps } = await supabase.from('cr_applications').select('*').eq('status', 'pending')
        const { data: s } = await supabase.from('authorized_staff').select('*').order('role', { ascending: true })
        if (apps) setApplications(apps)
        if (s) {
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

    const handleImpersonateCR = (s: any) => {
        startImpersonation({
            role: 'cr',
            email: s.email,
            name: s.name || s.email,
            section: s.section_interested !== 'N/A' ? s.section_interested : null,
            originalAdminEmail: adminEmail || 'admin@diu.edu.bd',
            impersonatedAt: new Date().toISOString()
        })
        toast.success(`Impersonating CR ${s.name || s.email}`)
        router.push('/cr/manage')
    }

    async function handleApprove(app: any) {
        const { error: staffError } = await supabase.from('authorized_staff').insert({
            email: app.email,
            name: app.full_name,
            role: 'cr'
        })

        if (staffError) {
            toast.error("Failed to add staff: " + getFriendlyErrorMessage(staffError.message))
            return
        }

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
            toast.error(getFriendlyErrorMessage(error.message))
            return
        }

        toast.success('Promoted to Admin')
        fetchData()
    }

    async function handleDemoteCR(staffId: string, staffEmail: string) {
        if (!confirm(`Demote ${staffEmail} from CR to regular student?`)) return
        const { error } = await supabase
            .from('authorized_staff')
            .update({ role: 'student' })
            .eq('id', staffId)

        if (error) { toast.error(getFriendlyErrorMessage(error.message)); return }

        await supabase.from('cr_applications').update({ status: 'rejected' }).eq('email', staffEmail).eq('status', 'approved')
        toast.success(`${staffEmail} demoted to Student.`)
        fetchData()
    }

    async function handleRemoveCR(staffId: string, staffEmail: string) {
        if (!confirm(`Remove ${staffEmail} from authorized staff entirely?`)) return
        const { error } = await supabase
            .from('authorized_staff')
            .delete()
            .eq('id', staffId)

        if (error) { toast.error(getFriendlyErrorMessage(error.message)); return }

        await supabase.from('cr_applications').update({ status: 'rejected' }).eq('email', staffEmail).eq('status', 'approved')
        toast.success(`${staffEmail} removed from staff.`)
        fetchData()
    }

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <Link 
                href="/admin" 
                className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to Admin Console
            </Link>

            {/* Header */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    Role Management
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">User &amp; CR Permissions</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                    Review incoming Class Representative applications and manage authorized portal roles.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending CR Applications */}
                <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden flex flex-col">
                    <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                <Bell className="w-4 h-4 text-primary" /> Pending CR Applications
                            </h3>
                            <p className="text-xs text-muted-foreground">Students requesting Class Representative authorization.</p>
                        </div>
                        {applications.length > 0 && (
                            <Badge variant="destructive" className="text-xs">
                                {applications.length} Pending
                            </Badge>
                        )}
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="text-xs">
                                    <TableHead className="font-semibold">Applicant</TableHead>
                                    <TableHead className="font-semibold">Section</TableHead>
                                    <TableHead className="text-right font-semibold">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-border/60">
                                {applications.map((app) => (
                                    <TableRow key={app.id} className="text-xs hover:bg-muted/30">
                                        <TableCell className="py-3">
                                            <div className="font-semibold text-foreground">{app.full_name}</div>
                                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono mt-0.5">
                                                <Mail className="h-3 w-3" /> {app.email}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px] font-mono">
                                                Sec {app.section_interested}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-1.5 justify-end">
                                                <Button size="icon" variant="outline" className="h-7 w-7 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleApprove(app)}>
                                                    <Check className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleReject(app.id)}>
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {applications.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic text-xs">
                                            No pending CR applications.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Existing Authorized Staff */}
                <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden flex flex-col">
                    <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20">
                        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-primary" /> Authorized Staff Directory
                        </h3>
                        <p className="text-xs text-muted-foreground">Admin, Developer, and approved CR staff.</p>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="text-xs">
                                    <TableHead className="font-semibold">User Email</TableHead>
                                    <TableHead className="font-semibold">Role</TableHead>
                                    <TableHead className="font-semibold">Section</TableHead>
                                    <TableHead className="text-right font-semibold">Controls</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-border/60">
                                {staff.map((s) => (
                                    <TableRow key={s.id} className="text-xs hover:bg-muted/30">
                                        <TableCell className="font-mono text-xs py-3">{s.email}</TableCell>
                                        <TableCell>
                                            <Badge 
                                                variant="outline" 
                                                className={`text-[9px] font-bold uppercase ${
                                                    s.role === 'admin' 
                                                        ? 'border-destructive/40 text-destructive bg-destructive/10' 
                                                        : s.role === 'developer' 
                                                        ? 'border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10' 
                                                        : 'border-primary/40 text-primary bg-primary/10'
                                                }`}
                                            >
                                                {s.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {s.role === 'cr' ? (
                                                <Badge variant="outline" className="text-[10px]">{s.section_interested}</Badge>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground/60">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {s.role === 'cr' ? (
                                                <div className="flex gap-1 justify-end">
                                                    <Button size="sm" variant="ghost" onClick={() => handleImpersonateCR(s)} className="h-7 text-[11px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 px-2" title="Impersonate CR">
                                                        <Eye className="h-3 w-3 mr-0.5" /> Impersonate
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => handlePromoteToAdmin(s.id)} className="h-7 text-[11px] text-primary hover:bg-primary/10 px-2">
                                                        <ArrowUpRight className="h-3 w-3 mr-0.5" /> Admin
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => handleDemoteCR(s.id, s.email)} className="h-7 text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 px-2">
                                                        <UserMinus className="h-3 w-3 mr-0.5" /> Demote
                                                    </Button>
                                                    <Button size="icon" variant="ghost" onClick={() => handleRemoveCR(s.id, s.email)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground/50">Permanent</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </div>
    )
}
