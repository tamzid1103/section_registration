'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
    Users,
    BookOpen,
    Clock,
    LogOut,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    GraduationCap,
    ShieldAlert,
    Info,
    Check,
    Lock,
    Sparkles,
    User,
    Mail,
    ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { invalidateCacheScopes } from '@/lib/cache/client'
import { getFriendlyErrorMessage } from '@/lib/utils'
import { findAdvisorForStudent } from '@/lib/advisor-assignment'
import { getImpersonationSession } from '@/lib/impersonation'

export default function StudentDashboard() {
    const supabase = createClient()
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [allowedInfo, setAllowedInfo] = useState<any>(null)
    const [semester, setSemester] = useState<any>(null)
    const [sections, setSections] = useState<any[]>([])
    const [labGroups, setLabGroups] = useState<any[]>([])
    const [registration, setRegistration] = useState<any>(null)

    // Form states
    const [selectedSection, setSelectedSection] = useState('')
    const [selectedLab, setSelectedLab] = useState('')
    const [studentNote, setStudentNote] = useState('')

    useEffect(() => {
        init()

        // Realtime updates
        const regCh = supabase.channel('student-reg-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
                refreshData()
            })
            .subscribe()

        const onImpersonationChange = () => {
            init()
        }
        window.addEventListener('diu:impersonation-change', onImpersonationChange)

        return () => {
            supabase.removeChannel(regCh)
            window.removeEventListener('diu:impersonation-change', onImpersonationChange)
        }
    }, [])

    async function init() {
        setLoading(true)
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) {
            router.push('/')
            return
        }
        setUser(currentUser)

        const impersonation = getImpersonationSession()
        const isImpersonatingStudent = impersonation && impersonation.role === 'student'
        const effectiveEmail = isImpersonatingStudent ? impersonation.email : currentUser.email

        // Fetch pre-authorized student info
        let resolvedAllowed: any = null
        if (isImpersonatingStudent && impersonation.studentId) {
            const { data: allowedById } = await supabase
                .from('allowed_students')
                .select('*')
                .eq('student_id', impersonation.studentId)
                .maybeSingle()
            resolvedAllowed = allowedById
        }

        if (!resolvedAllowed) {
            const { data: allowed } = await supabase
                .from('allowed_students')
                .select('*')
                .eq('email', effectiveEmail)
                .maybeSingle()
            resolvedAllowed = allowed
        }

        if (!resolvedAllowed) {
            if (isImpersonatingStudent) {
                resolvedAllowed = {
                    id: null,
                    email: impersonation.email,
                    student_id: impersonation.studentId || '',
                    name: impersonation.name || 'Student',
                }
            } else {
                const domain = (currentUser.email || '').split('@')[1] || ''
                const isEduDomain = domain === 'diu.edu.bd' || domain === 'daffodilvarsity.edu.bd'
                if (!isEduDomain) {
                    toast.error('You are not authorized to access the student portal.')
                    router.push('/')
                    return
                }
                const { data: staffRec } = await supabase
                    .from('authorized_staff')
                    .select('name')
                    .eq('email', currentUser.email)
                    .maybeSingle()
                const metaStudentId = currentUser.user_metadata?.student_id || ''
                const metaName = staffRec?.name || currentUser.user_metadata?.full_name || currentUser.email
                resolvedAllowed = {
                    id: null,
                    email: currentUser.email,
                    student_id: metaStudentId,
                    name: metaName,
                }
            }
        }
        setAllowedInfo(resolvedAllowed)

        // Fetch Active Semester
        const { data: sem } = await supabase
            .from('semesters')
            .select('*')
            .eq('is_active', true)
            .maybeSingle()
        setSemester(sem)

        if (sem) {
            const [regRes, secRes] = await Promise.all([
                supabase
                    .from('registrations')
                    .select('*, sections!inner(name, semester_id), lab_groups(name), advisors(name, email, designation, phone, cabin)')
                    .eq('student_id', resolvedAllowed.student_id)
                    .eq('sections.semester_id', sem.id)
                    .maybeSingle(),
                supabase
                    .from('sections')
                    .select('*, registrations(id)')
                    .eq('semester_id', sem.id)
                    .order('name')
            ])

            if (regRes.data) {
                setRegistration(regRes.data)
                setSelectedSection(regRes.data.section_id || '')
                setSelectedLab(regRes.data.lab_group_id || 'none')
                setStudentNote(regRes.data.note || '')

                if (regRes.data.section_id) {
                    await loadLabGroupsWithCounts(regRes.data.section_id)
                }
            } else {
                setRegistration(null)
            }

            if (secRes.data) {
                const parsed = secRes.data.map(sec => ({
                    ...sec,
                    current: sec.registrations ? sec.registrations.length : 0
                }))
                setSections(parsed)
            }
        }

        setLoading(false)
    }

    async function loadLabGroupsWithCounts(secId: string) {
        if (!secId) {
            setLabGroups([])
            return
        }
        const [labsRes, regsRes] = await Promise.all([
            supabase.from('lab_groups').select('*').eq('section_id', secId).order('name'),
            supabase.from('registrations').select('id, lab_group_id').eq('section_id', secId)
        ])
        if (labsRes.data) {
            const counts: Record<string, number> = {}
            for (const r of (regsRes.data || [])) {
                if (r.lab_group_id) {
                    counts[r.lab_group_id] = (counts[r.lab_group_id] || 0) + 1
                }
            }
            const parsed = labsRes.data.map((lg: any) => ({
                ...lg,
                capacity: lg.capacity || 25,
                current: counts[lg.id] || 0
            }))
            setLabGroups(parsed)
        } else {
            setLabGroups([])
        }
    }

    async function refreshData() {
        if (!allowedInfo || !semester) return
        const studentId = allowedInfo.student_id

        const [regRes, secRes] = await Promise.all([
            supabase
                .from('registrations')
                .select('*, sections!inner(name, semester_id), lab_groups(name), advisors(name, email, designation, phone, cabin)')
                .eq('student_id', studentId)
                .eq('sections.semester_id', semester.id)
                .maybeSingle(),
            supabase
                .from('sections')
                .select('*, registrations(id)')
                .eq('semester_id', semester.id)
                .order('name')
        ])

        if (regRes.data) {
            setRegistration(regRes.data)
            setSelectedSection(regRes.data.section_id || '')
            setSelectedLab(regRes.data.lab_group_id || 'none')
            setStudentNote(regRes.data.note || '')

            if (regRes.data.section_id) {
                await loadLabGroupsWithCounts(regRes.data.section_id)
            }
        } else {
            setRegistration(null)
        }

        if (secRes.data) {
            const parsed = secRes.data.map(sec => ({
                ...sec,
                current: sec.registrations ? sec.registrations.length : 0
            }))
            setSections(parsed)
        }
    }

    async function handleSectionChange(secId: string) {
        if (isLockedState) return
        setSelectedSection(secId)
        setSelectedLab('none')
        await loadLabGroupsWithCounts(secId)
    }

    async function handleRegisterOrEditSubmit(e?: React.FormEvent) {
        if (e) e.preventDefault()
        if (!selectedSection) { toast.error('Please select a section.'); return }
        if (semester?.is_locked) { toast.error('This semester is locked. Updates are disabled.'); return }

        if (registration && registration.advisor_completed) {
            toast.error('Your registration has been completed by your advisor and cannot be modified.')
            return
        }

        if (registration && registration.student_edit_count >= 3) {
            toast.error('You have already reached the maximum edit limit of 3 changes.')
            return
        }

        const labVal = selectedLab === 'none' ? null : (selectedLab || null)

        // Validate lab capacity (25 max)
        if (labVal) {
            const targetLab = labGroups.find(l => l.id === labVal)
            if (targetLab) {
                const isCurrentLab = registration && registration.lab_group_id === labVal
                const cap = targetLab.capacity || 25
                if (targetLab.current >= cap && !isCurrentLab) {
                    toast.error(`Lab ${targetLab.name} is full (${targetLab.current}/${cap} seats filled). Please choose another lab group.`)
                    return
                }
            }
        }

        setSubmitting(true)
        try {
            const advisorId = await findAdvisorForStudent(allowedInfo.student_id, semester?.id)

            if (registration) {
                const newEditCount = (registration.student_edit_count || 0) + 1
                const { error } = await supabase.from('registrations').update({
                    section_id: selectedSection,
                    lab_group_id: labVal,
                    advisor_id: advisorId,
                    note: studentNote.trim(),
                    student_edit_count: newEditCount
                }).eq('id', registration.id)

                if (error) {
                    toast.error(getFriendlyErrorMessage(error.message))
                } else {
                    const { data: secData } = await supabase.from('sections').select('name').eq('id', selectedSection).single()
                    const labName = labGroups.find(l => l.id === labVal)?.name
                    const labText = labName ? `, Lab: ${labName}` : ' (No Lab)'
                    const msgText = studentNote.trim() ? ` | Message to Advisor: "${studentNote.trim()}"` : ''
                    await supabase.from('audit_logs').insert({
                        user_id: user.id,
                        role: 'student',
                        action: 'EDIT',
                        note: `Student ${allowedInfo.name} (${allowedInfo.student_id}) self-modified registration (${newEditCount}/3): Section ${secData?.name || ''}${labText}${msgText}`
                    })

                    toast.success('Section choices updated successfully!')
                    await refreshData()
                    await invalidateCacheScopes(['home', 'admin'])
                }
            } else {
                const { data: anyExisting } = await supabase
                    .from('registrations')
                    .select('id')
                    .eq('student_id', allowedInfo.student_id)
                    .maybeSingle()

                let error: any = null

                if (anyExisting) {
                    const { error: updateErr } = await supabase.from('registrations').update({
                        student_name: allowedInfo.name,
                        section_id: selectedSection,
                        lab_group_id: labVal,
                        advisor_id: advisorId,
                        entered_by: null,
                        note: studentNote.trim(),
                        student_edit_count: 0,
                        advisor_completed: false,
                        advisor_note: null,
                        timestamp: new Date().toISOString(),
                    }).eq('id', anyExisting.id)
                    error = updateErr
                } else {
                    const { error: insertErr } = await supabase.from('registrations').insert({
                        student_name: allowedInfo.name,
                        student_id: allowedInfo.student_id,
                        section_id: selectedSection,
                        lab_group_id: labVal,
                        advisor_id: advisorId,
                        entered_by: null,
                        note: studentNote.trim(),
                        student_edit_count: 0
                    })
                    error = insertErr
                }

                if (error) {
                    toast.error(getFriendlyErrorMessage(error.message))
                } else {
                    const { data: secData } = await supabase.from('sections').select('name').eq('id', selectedSection).single()
                    const labName = labGroups.find(l => l.id === labVal)?.name
                    const labText = labName ? `, Lab: ${labName}` : ' (No Lab)'
                    const msgText = studentNote.trim() ? ` | Message to Advisor: "${studentNote.trim()}"` : ''
                    await supabase.from('audit_logs').insert({
                        user_id: user.id,
                        role: 'student',
                        action: 'ADD',
                        note: `Student ${allowedInfo.name} (${allowedInfo.student_id}) self-registered: Section ${secData?.name || ''}${labText}${msgText}`
                    })

                    toast.success('Registration successful!')
                    await refreshData()
                    await invalidateCacheScopes(['home', 'admin'])
                }
            }
        } catch (err: any) {
            toast.error(getFriendlyErrorMessage(err.message || 'An unexpected error occurred.'))
        } finally {
            setSubmitting(false)
        }
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/')
    }

    const isLockedState = Boolean(
        semester?.is_locked ||
        (registration && (registration.advisor_completed || registration.student_edit_count >= 3))
    )

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs font-medium text-muted-foreground">Loading your registration portal...</p>
            </div>
        )
    }

    const currentSelectedSectionData = sections.find(s => s.id === selectedSection)

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
            {/* Top Academic Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Section Pre-Registration</h1>
                        {semester?.name && (
                            <Badge variant="outline" className="text-xs font-medium bg-muted/60 text-muted-foreground border-border">
                                {semester.name}
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Select your preferred class section and lab group for the active semester.</p>
                </div>

                <div className="flex items-center gap-2.5">
                    {registration ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium text-foreground">Changes:</span>
                            <span className="font-semibold text-primary">{registration.student_edit_count || 0}/3</span>
                        </div>
                    ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-xs py-1">
                            New Registration
                        </Badge>
                    )}
                </div>
            </div>

            {/* Lock / Warning Alert Banners */}
            {registration && registration.advisor_completed ? (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/20 dark:border-emerald-900/60 flex items-start gap-3 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold">Registration Verified &amp; Completed by Advisor</p>
                        <p className="text-emerald-700 dark:text-emerald-300/90 mt-0.5">Your advisor has reviewed and completed your section assignment. Your selection is locked for final department scheduling.</p>
                    </div>
                </div>
            ) : registration && registration.student_edit_count >= 3 ? (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 dark:bg-rose-950/20 dark:border-rose-900/60 flex items-start gap-3 text-xs sm:text-sm text-rose-900 dark:text-rose-200">
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold">Maximum Change Limit Reached (3/3)</p>
                        <p className="text-rose-700 dark:text-rose-300/90 mt-0.5">You have utilized all 3 self-modification chances. If you require further adjustments, please contact your section CR or assigned Advisor.</p>
                    </div>
                </div>
            ) : semester?.is_locked ? (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/60 flex items-start gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold">Registration Window Locked</p>
                        <p className="text-amber-700 dark:text-amber-300/90 mt-0.5">The pre-registration window for this semester is currently closed by department administration.</p>
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
                {/* Main Selection Area (2 Columns) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Step 1: Section Cards Grid */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Select Class Section</h2>
                            </div>
                            <span className="text-xs text-muted-foreground">{sections.length} sections offered</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {sections.map(sec => {
                                const isCurrent = registration?.section_id === sec.id
                                const isSelected = selectedSection === sec.id
                                const isFull = sec.current >= sec.capacity && !isCurrent
                                const pct = Math.min(100, Math.round((sec.current / sec.capacity) * 100))
                                const isAlmostFull = pct >= 80 && !isFull

                                return (
                                    <button
                                        key={sec.id}
                                        type="button"
                                        disabled={isFull || isLockedState}
                                        onClick={() => handleSectionChange(sec.id)}
                                        className={`p-4 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between relative group ${
                                            isSelected
                                                ? 'border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10 shadow-xs'
                                                : isFull
                                                    ? 'opacity-60 bg-muted/40 border-border cursor-not-allowed'
                                                    : 'bg-card border-border hover:border-border/80 hover:shadow-2xs'
                                        }`}
                                    >
                                        <div className="space-y-2 w-full">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <h3 className="font-bold text-sm text-foreground">Section {sec.name}</h3>
                                                    {isCurrent && (
                                                        <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30 px-1.5 py-0">
                                                            Current
                                                        </Badge>
                                                    )}
                                                </div>
                                                {isSelected ? (
                                                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                                        <Check className="w-3 h-3 stroke-[3]" />
                                                    </span>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] font-semibold px-2 py-0.5 ${
                                                            isFull
                                                                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                                                : isAlmostFull
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                                                    : 'bg-muted/70 text-muted-foreground border-border'
                                                        }`}
                                                    >
                                                        {isFull ? 'FULL' : isAlmostFull ? 'Almost Full' : 'Available'}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Progress meter */}
                                            <div className="space-y-1">
                                                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-300 ${
                                                            isFull ? 'bg-rose-500' : isAlmostFull ? 'bg-amber-500' : 'bg-primary'
                                                        }`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                    <span>{sec.current}/{sec.capacity} seats</span>
                                                    <span>{sec.capacity - sec.current} left</span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Step 2: Lab Group Selection */}
                    {selectedSection && (
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Select Lab Group</h2>
                                </div>
                                <span className="text-xs text-muted-foreground">Max 25 students per lab</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    disabled={isLockedState}
                                    onClick={() => setSelectedLab('none')}
                                    className={`p-3.5 rounded-xl border text-left transition-all duration-150 ${
                                        selectedLab === 'none' || !selectedLab
                                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10 font-semibold'
                                            : 'bg-card border-border hover:border-border/80 text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold">No Lab Group</p>
                                        {(selectedLab === 'none' || !selectedLab) && (
                                            <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Theory-only enrollment</p>
                                </button>

                                {labGroups.map(lab => {
                                    const isCurrentLab = registration?.lab_group_id === lab.id
                                    const isSelected = selectedLab === lab.id
                                    const cap = lab.capacity || 25
                                    const isFull = (lab.current || 0) >= cap && !isCurrentLab
                                    const isAlmostFull = (lab.current || 0) >= 20 && !isFull

                                    return (
                                        <button
                                            key={lab.id}
                                            type="button"
                                            disabled={isFull || isLockedState}
                                            onClick={() => setSelectedLab(lab.id)}
                                            className={`p-3.5 rounded-xl border text-left transition-all duration-150 relative ${
                                                isSelected
                                                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10'
                                                    : isFull
                                                        ? 'opacity-60 bg-muted/40 border-border cursor-not-allowed'
                                                        : 'bg-card border-border hover:border-border/80'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-bold text-foreground">Lab {lab.name}</p>
                                                {isSelected ? (
                                                    <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />
                                                ) : isFull ? (
                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-rose-50 text-rose-700 border-rose-200">FULL</Badge>
                                                ) : null}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                                {lab.current || 0}/{cap} seats filled
                                            </p>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Message / Retake Note */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Message for Advisor &amp; Retake Courses</h2>
                            <span className="text-xs text-muted-foreground">(Optional)</span>
                        </div>

                        <div className="p-3 rounded-lg border border-border/80 bg-muted/30 text-xs text-muted-foreground flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>
                                <strong>Taking retakes?</strong> List your course code and title (e.g., <code className="font-mono text-foreground font-semibold">CSE115 - Programming I</code>) so your assigned advisor can verify and authorize during clearing.
                            </span>
                        </div>

                        <Textarea
                            placeholder="Write your retake course code(s) or scheduling clash notes here..."
                            value={studentNote}
                            onChange={e => setStudentNote(e.target.value)}
                            rows={3}
                            disabled={isLockedState || submitting}
                            className="bg-card text-foreground border-border text-sm resize-none rounded-xl"
                        />
                    </div>

                    {/* Desktop Submit Button */}
                    <div className="pt-2">
                        <Button
                            type="button"
                            onClick={() => handleRegisterOrEditSubmit()}
                            disabled={!selectedSection || isLockedState || submitting}
                            className="w-full sm:w-auto h-11 px-8 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-all"
                        >
                            {submitting ? (
                                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving Choice...</>
                            ) : registration ? (
                                <><CheckCircle2 className="w-4 h-4 mr-2" /> Update Section Choice</>
                            ) : (
                                <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Section Registration</>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Right Sidebar Details Column */}
                <div className="space-y-5">
                    {/* Student Profile Card */}
                    <Card className="border-border shadow-xs">
                        <CardHeader className="pb-3 border-b border-border/70">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <User className="w-4 h-4 text-primary" /> Student Identity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-3.5 text-xs">
                            <div>
                                <p className="text-[10px] font-bold uppercase text-muted-foreground/70">Full Name</p>
                                <p className="font-bold text-sm text-foreground mt-0.5">{allowedInfo?.name || 'Student'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground/70">Student ID</p>
                                    <p className="font-mono font-semibold text-foreground mt-0.5">{allowedInfo?.student_id || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground/70">Department</p>
                                    <p className="font-semibold text-foreground mt-0.5">CSE, DIU</p>
                                </div>
                            </div>
                            <div className="pt-1 border-t border-border/60">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground/70">University Email</p>
                                <p className="text-muted-foreground truncate mt-0.5">{allowedInfo?.email}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Current Enrollment Summary */}
                    {registration && (
                        <Card className="border-border shadow-xs bg-muted/20">
                            <CardHeader className="pb-3 border-b border-border/70">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-primary" /> Active Enrollment
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-3.5 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Section:</span>
                                    <span className="font-bold text-foreground">Section {registration.sections?.name}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Lab Group:</span>
                                    <span className="font-bold text-foreground">{registration.lab_groups?.name ? `Lab ${registration.lab_groups.name}` : 'None'}</span>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-border/60">
                                    <span className="text-muted-foreground">Advising Status:</span>
                                    {registration.advisor_completed ? (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold">
                                            Completed ✓
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-bold">
                                            Pending Review
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Advisor Details & Feedback Card */}
                    {registration && (
                        <Card className="border-border shadow-xs">
                            <CardHeader className="pb-3 border-b border-border/70">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-primary" /> Assigned Faculty Advisor
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-3.5 text-xs">
                                <div>
                                    <p className="font-bold text-sm text-foreground">{registration.advisors?.name || 'Advisor Assigned'}</p>
                                    <p className="text-muted-foreground text-[11px] mt-0.5">
                                        {registration.advisors?.designation || 'Faculty Member'} {registration.advisors?.cabin ? `· Cabin ${registration.advisors.cabin}` : ''}
                                    </p>
                                    {registration.advisors?.email && (
                                        <p className="text-muted-foreground/80 text-[11px] mt-0.5">{registration.advisors.email}</p>
                                    )}
                                </div>

                                {registration.advisor_note && (
                                    <div className="p-3 rounded-lg border border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/40 space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Note from Advisor</p>
                                        <p className="text-foreground italic font-medium">"{registration.advisor_note}"</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
