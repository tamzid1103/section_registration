'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    getImpersonationSession,
    startImpersonation,
    stopImpersonation,
    getRoleTargetUrl,
    ImpersonationSession,
    ImpersonationRole
} from '@/lib/impersonation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
    Eye,
    LogOut,
    GraduationCap,
    Users,
    CheckCircle2,
    Search,
    ArrowRight,
    ArrowLeft,
    ShieldAlert,
    ExternalLink,
    UserCheck,
    Sparkles,
    RefreshCw,
    Compass
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AdminImpersonatePage() {
    const supabase = createClient()
    const router = useRouter()

    const [currentSession, setCurrentSession] = useState<ImpersonationSession | null>(null)
    const [adminEmail, setAdminEmail] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(true)

    // Data lists
    const [advisors, setAdvisors] = useState<any[]>([])
    const [crs, setCrs] = useState<any[]>([])
    const [students, setStudents] = useState<any[]>([])
    const [activeSemester, setActiveSemester] = useState<any>(null)

    // Filter states
    const [advisorSearch, setAdvisorSearch] = useState('')
    const [crSearch, setCrSearch] = useState('')
    const [studentSearch, setStudentSearch] = useState('')

    // Quick direct student impersonate
    const [quickStudentId, setQuickStudentId] = useState('')
    const [quickStudentName, setQuickStudentName] = useState('')
    const [quickStudentEmail, setQuickStudentEmail] = useState('')

    useEffect(() => {
        loadData()

        const onImpersonationChange = (e: any) => {
            setCurrentSession(e.detail || getImpersonationSession())
        }
        window.addEventListener('diu:impersonation-change', onImpersonationChange)

        return () => {
            window.removeEventListener('diu:impersonation-change', onImpersonationChange)
        }
    }, [])

    async function loadData() {
        setLoading(true)
        setCurrentSession(getImpersonationSession())

        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
            setAdminEmail(user.email)
        }

        // Active semester
        const { data: sem } = await supabase
            .from('semesters')
            .select('*')
            .eq('is_active', true)
            .maybeSingle()
        setActiveSemester(sem)

        // 1. Fetch advisors with ranges
        const { data: advData } = await supabase
            .from('advisors')
            .select('*, student_advisor_ranges(start_id, end_id)')
            .order('name')
        if (advData) setAdvisors(advData)

        // 2. Fetch CRs (authorized_staff where role = 'cr' + cr_applications)
        const { data: staffCrs } = await supabase
            .from('authorized_staff')
            .select('*')
            .eq('role', 'cr')
            .order('name')

        const { data: approvedApps } = await supabase
            .from('cr_applications')
            .select('*')
            .eq('status', 'approved')

        const appMap: Record<string, any> = {}
        ;(approvedApps || []).forEach(app => {
            if (app.email) appMap[app.email.toLowerCase()] = app
        })

        const mergedCrs = (staffCrs || []).map(cr => ({
            ...cr,
            section: appMap[cr.email.toLowerCase()]?.section_interested || 'General',
            student_id: appMap[cr.email.toLowerCase()]?.student_id || null,
            phone: appMap[cr.email.toLowerCase()]?.phone || null
        }))
        setCrs(mergedCrs)

        // 3. Fetch allowed students (first 150)
        const { data: stuData } = await supabase
            .from('allowed_students')
            .select('*')
            .order('student_id', { ascending: true })
            .limit(200)

        // Get registration status for active semester if exists
        if (stuData && sem) {
            const studentIds = stuData.map(s => s.student_id).filter(Boolean)
            const { data: regs } = await supabase
                .from('registrations')
                .select('student_id, sections(name), lab_groups(name)')
                .in('student_id', studentIds)
                .eq('sections.semester_id', sem.id)

            const regMap: Record<string, any> = {}
            ;(regs || []).forEach(r => {
                regMap[r.student_id] = r
            })

            const enriched = stuData.map(s => ({
                ...s,
                registration: regMap[s.student_id] || null
            }))
            setStudents(enriched)
        } else if (stuData) {
            setStudents(stuData)
        }

        setLoading(false)
    }

    const handleImpersonate = (
        role: ImpersonationRole,
        email: string,
        name: string,
        options?: { studentId?: string | null; section?: string | null; advisorId?: string | null }
    ) => {
        const session: ImpersonationSession = {
            role,
            email,
            name,
            studentId: options?.studentId || null,
            section: options?.section || null,
            advisorId: options?.advisorId || null,
            originalAdminEmail: adminEmail || 'admin@diu.edu.bd',
            impersonatedAt: new Date().toISOString()
        }

        startImpersonation(session)
        setCurrentSession(session)
        toast.success(`Impersonating ${name} (${role.toUpperCase()})`)

        const targetUrl = getRoleTargetUrl(role)
        router.push(targetUrl)
    }

    const handleExitImpersonation = () => {
        stopImpersonation()
        setCurrentSession(null)
        toast.success('Exited impersonation. Back in Admin Console.')
    }

    const handleQuickStudentImpersonate = (e: React.FormEvent) => {
        e.preventDefault()
        if (!quickStudentId.trim() && !quickStudentEmail.trim()) {
            toast.error('Please enter a Student ID or DIU Email')
            return
        }

        const sid = quickStudentId.trim()
        const resolvedEmail = quickStudentEmail.trim() || `${sid}@diu.edu.bd`
        const resolvedName = quickStudentName.trim() || `Student ${sid}`

        handleImpersonate('student', resolvedEmail, resolvedName, { studentId: sid })
    }

    const filteredAdvisors = advisors.filter(a =>
        a.name?.toLowerCase().includes(advisorSearch.toLowerCase()) ||
        a.email?.toLowerCase().includes(advisorSearch.toLowerCase()) ||
        a.designation?.toLowerCase().includes(advisorSearch.toLowerCase())
    )

    const filteredCrs = crs.filter(c =>
        c.name?.toLowerCase().includes(crSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(crSearch.toLowerCase()) ||
        c.section?.toLowerCase().includes(crSearch.toLowerCase())
    )

    const filteredStudents = students.filter(s =>
        s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.student_id?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.email?.toLowerCase().includes(studentSearch.toLowerCase())
    )

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link href="/admin">
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1">
                                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
                            </Button>
                        </Link>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                        <UserCheck className="w-6 h-6 text-primary" />
                        User Impersonation Console
                    </h1>
                    <p className="text-xs text-muted-foreground max-w-2xl">
                        Switch seamlessly into any Faculty Advisor, Class Representative (CR), or Student account to inspect their exact dashboard, verify live registrations, and diagnose user issues in real time.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadData}
                        disabled={loading}
                        className="h-8 text-xs gap-1.5"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Data
                    </Button>
                </div>
            </div>

            {/* Active Impersonation Alert Banner Card */}
            {currentSession && (
                <Card className="border-2 border-amber-500/60 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-sm">
                    <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                                <Eye className="w-5 h-5 animate-pulse" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider">
                                        Active Persona
                                    </Badge>
                                    <span className="font-bold text-sm text-foreground">
                                        {currentSession.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        ({currentSession.studentId || currentSession.email})
                                    </span>
                                    {currentSession.section && (
                                        <Badge variant="outline" className="text-[10px] font-semibold border-amber-500/40 text-amber-700 dark:text-amber-300">
                                            Section {currentSession.section}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Currently operating as <strong className="text-foreground capitalize">{currentSession.role}</strong>. All portal navigation and views will reflect this user.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
                            <Button
                                size="sm"
                                onClick={() => router.push(getRoleTargetUrl(currentSession.role))}
                                className="h-8 text-xs font-semibold gap-1.5 flex-1 sm:flex-initial"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Open Dashboard
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={handleExitImpersonation}
                                className="h-8 text-xs font-semibold gap-1.5 flex-1 sm:flex-initial"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Exit Persona
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Student Jump Card */}
            <Card className="border border-border/80 shadow-xs">
                <CardHeader className="p-4 sm:p-5 pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" /> Direct Student Impersonation
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Instantly diagnose any student by entering their Student ID or email, even if not listed in the quick tables below.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 pt-0">
                    <form onSubmit={handleQuickStudentImpersonate} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <Input
                            placeholder="Student ID (e.g. 231-15-587)"
                            value={quickStudentId}
                            onChange={e => setQuickStudentId(e.target.value)}
                            className="h-8 text-xs bg-background font-mono"
                        />
                        <Input
                            placeholder="Student Name (optional)"
                            value={quickStudentName}
                            onChange={e => setQuickStudentName(e.target.value)}
                            className="h-8 text-xs bg-background"
                        />
                        <Input
                            placeholder="Student Email (optional)"
                            value={quickStudentEmail}
                            onChange={e => setQuickStudentEmail(e.target.value)}
                            className="h-8 text-xs bg-background font-mono"
                        />
                        <Button type="submit" size="sm" className="h-8 text-xs font-semibold gap-1.5">
                            <Eye className="w-3.5 h-3.5" /> Impersonate Student
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Main Tabs Console */}
            <Tabs defaultValue="advisors" className="space-y-4">
                <TabsList className="bg-muted/60 p-1 border border-border/60 rounded-xl grid grid-cols-3 max-w-md">
                    <TabsTrigger value="advisors" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                        <GraduationCap className="w-3.5 h-3.5 text-primary" />
                        Advisors ({advisors.length})
                    </TabsTrigger>
                    <TabsTrigger value="crs" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                        <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        CRs ({crs.length})
                    </TabsTrigger>
                    <TabsTrigger value="students" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        Students ({students.length})
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: Faculty Advisors */}
                <TabsContent value="advisors" className="space-y-4 m-0">
                    <Card className="border border-border/80 shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-primary" />
                                    Faculty Advisors Directory
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Impersonate any advisor to view their allocated advising roster, mark completions, and write notes.
                                </p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search advisor by name, email..."
                                    value={advisorSearch}
                                    onChange={e => setAdvisorSearch(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-background"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="text-xs">
                                        <TableHead className="font-semibold">Advisor Name</TableHead>
                                        <TableHead className="font-semibold">DIU Email</TableHead>
                                        <TableHead className="font-semibold">Designation</TableHead>
                                        <TableHead className="font-semibold">Assigned ID Ranges</TableHead>
                                        <TableHead className="text-right font-semibold">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-border/60">
                                    {filteredAdvisors.map(adv => {
                                        const ranges = (adv.student_advisor_ranges || [])
                                            .map((r: any) => `${r.start_id}–${r.end_id}`)
                                            .join(', ') || 'None assigned'
                                        const isCurrent = currentSession?.role === 'advisor' && currentSession?.email.toLowerCase() === adv.email.toLowerCase()

                                        return (
                                            <TableRow key={adv.id} className={`text-xs hover:bg-muted/30 ${isCurrent ? 'bg-amber-500/10' : ''}`}>
                                                <TableCell className="font-semibold text-foreground py-3">
                                                    {adv.name}
                                                    {isCurrent && (
                                                        <Badge className="ml-2 bg-amber-500 text-white text-[9px] font-bold">Active</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-muted-foreground">{adv.email}</TableCell>
                                                <TableCell className="text-muted-foreground">{adv.designation || 'Faculty'}</TableCell>
                                                <TableCell className="text-muted-foreground font-mono text-[11px] max-w-xs truncate">
                                                    {ranges}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant={isCurrent ? "outline" : "default"}
                                                        onClick={() => handleImpersonate('advisor', adv.email, adv.name, { advisorId: adv.id })}
                                                        className="h-7 text-[11px] font-semibold gap-1 px-3 shadow-xs"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        {isCurrent ? 'View Portal' : 'Impersonate'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                    {filteredAdvisors.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic text-xs">
                                                {advisorSearch ? 'No advisors matching search.' : 'No advisors found.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>

                {/* TAB 2: Class Representatives */}
                <TabsContent value="crs" className="space-y-4 m-0">
                    <Card className="border border-border/80 shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    Class Representatives (CRs)
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Impersonate a CR to test section registration operations, live CSV imports, and section student lists.
                                </p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search CR by name, email, section..."
                                    value={crSearch}
                                    onChange={e => setCrSearch(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-background"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="text-xs">
                                        <TableHead className="font-semibold">CR Name</TableHead>
                                        <TableHead className="font-semibold">DIU Email</TableHead>
                                        <TableHead className="font-semibold">Assigned Section</TableHead>
                                        <TableHead className="font-semibold">Phone</TableHead>
                                        <TableHead className="text-right font-semibold">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-border/60">
                                    {filteredCrs.map(cr => {
                                        const isCurrent = currentSession?.role === 'cr' && currentSession?.email.toLowerCase() === cr.email.toLowerCase()
                                        return (
                                            <TableRow key={cr.id} className={`text-xs hover:bg-muted/30 ${isCurrent ? 'bg-amber-500/10' : ''}`}>
                                                <TableCell className="font-semibold text-foreground py-3">
                                                    {cr.name}
                                                    {isCurrent && (
                                                        <Badge className="ml-2 bg-amber-500 text-white text-[9px] font-bold">Active</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-muted-foreground">{cr.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                                                        {cr.section}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-[11px] font-mono">{cr.phone || '—'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant={isCurrent ? "outline" : "default"}
                                                        onClick={() => handleImpersonate('cr', cr.email, cr.name, { section: cr.section, studentId: cr.student_id })}
                                                        className="h-7 text-[11px] font-semibold gap-1 px-3 shadow-xs"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        {isCurrent ? 'View Portal' : 'Impersonate'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                    {filteredCrs.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic text-xs">
                                                {crSearch ? 'No CRs matching search.' : 'No authorized CRs found.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>

                {/* TAB 3: Students */}
                <TabsContent value="students" className="space-y-4 m-0">
                    <Card className="border border-border/80 shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                    Eligible Student Roster
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Impersonate any student to check their live section choices, lab allocation, and view student submission limits.
                                </p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search student by ID, name, email..."
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-background"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="text-xs">
                                        <TableHead className="font-semibold">Student ID</TableHead>
                                        <TableHead className="font-semibold">Name</TableHead>
                                        <TableHead className="font-semibold">DIU Email</TableHead>
                                        <TableHead className="font-semibold">Current Registration</TableHead>
                                        <TableHead className="text-right font-semibold">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-border/60">
                                    {filteredStudents.map(stu => {
                                        const isCurrent = currentSession?.role === 'student' &&
                                            (currentSession?.studentId === stu.student_id || currentSession?.email.toLowerCase() === stu.email?.toLowerCase())
                                        const reg = stu.registration
                                        const sectionName = reg?.sections?.name
                                        const labName = reg?.lab_groups?.name

                                        return (
                                            <TableRow key={stu.id || stu.student_id} className={`text-xs hover:bg-muted/30 ${isCurrent ? 'bg-amber-500/10' : ''}`}>
                                                <TableCell className="font-mono font-medium text-foreground py-3">
                                                    {stu.student_id}
                                                    {isCurrent && (
                                                        <Badge className="ml-2 bg-amber-500 text-white text-[9px] font-bold">Active</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-medium text-foreground">{stu.name}</TableCell>
                                                <TableCell className="font-mono text-muted-foreground text-[11px]">{stu.email || '—'}</TableCell>
                                                <TableCell>
                                                    {sectionName ? (
                                                        <span className="inline-flex items-center gap-1 font-semibold text-primary">
                                                            Section {sectionName} {labName ? `(${labName})` : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/60 italic text-[11px]">Not registered yet</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant={isCurrent ? "outline" : "default"}
                                                        onClick={() => handleImpersonate('student', stu.email || `${stu.student_id}@diu.edu.bd`, stu.name, {
                                                            studentId: stu.student_id,
                                                            section: sectionName || null
                                                        })}
                                                        className="h-7 text-[11px] font-semibold gap-1 px-3 shadow-xs"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        {isCurrent ? 'View Portal' : 'Impersonate'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                    {filteredStudents.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic text-xs">
                                                {studentSearch ? 'No student records match search.' : 'No students found.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
