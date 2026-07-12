'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, BookOpen, Clock, LogOut, CheckCircle2, AlertTriangle, RefreshCw, GraduationCap, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { invalidateCacheScopes } from '@/lib/cache/client'

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

        return () => {
            supabase.removeChannel(regCh)
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

        // Fetch pre-authorized student info
        const { data: allowed, error: allowedErr } = await supabase
            .from('allowed_students')
            .select('*')
            .eq('email', currentUser.email)
            .maybeSingle()

        if (allowedErr || !allowed) {
            toast.error('You are not pre-authorized as a student.')
            router.push('/')
            return
        }
        setAllowedInfo(allowed)

        // Fetch Active Semester
        const { data: sem } = await supabase
            .from('semesters')
            .select('*')
            .eq('is_active', true)
            .maybeSingle()
        setSemester(sem)

        if (sem) {
            // Load sections and current registrations in parallel
            const [regRes, secRes] = await Promise.all([
                supabase
                    .from('registrations')
                    .select('*, sections(name), lab_groups(name), advisors(name, email, designation)')
                    .eq('student_id', allowed.student_id)
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

                // Fetch lab groups for this section
                const { data: labs } = await supabase
                    .from('lab_groups')
                    .select('*')
                    .eq('section_id', regRes.data.section_id)
                    .order('name')
                setLabGroups(labs || [])
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

    async function refreshData() {
        if (!allowedInfo || !semester) return
        const studentId = allowedInfo.student_id

        const [regRes, secRes] = await Promise.all([
            supabase
                .from('registrations')
                .select('*, sections(name), lab_groups(name), advisors(name, email, designation)')
                .eq('student_id', studentId)
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

            // Fetch lab groups for this section
            const { data: labs } = await supabase
                .from('lab_groups')
                .select('*')
                .eq('section_id', regRes.data.section_id)
                .order('name')
            setLabGroups(labs || [])
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
        setSelectedSection(secId)
        setSelectedLab('none')

        const { data } = await supabase
            .from('lab_groups')
            .select('*')
            .eq('section_id', secId)
            .order('name')
        setLabGroups(data || [])
    }

    // Auto-lookup advisor range
    async function getAdvisorId(studentId: string) {
        const numId = parseInt(studentId.replace(/-/g, ''))
        let advisorId: string | null = null
        const { data: ranges } = await supabase.from('student_advisor_ranges')
            .select('advisor_id, start_id_numeric, end_id_numeric').eq('semester_id', semester.id)
        if (ranges) {
            const match = ranges.find(r => numId >= Number(r.start_id_numeric) && numId <= Number(r.end_id_numeric))
            advisorId = match?.advisor_id || null
        }
        return advisorId
    }

    async function handleRegisterOrEditSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedSection) { toast.error('Please select a section.'); return }
        if (semester?.is_locked) { toast.error('This semester is locked. Updates are disabled.'); return }
        
        if (registration && registration.student_edit_count >= 3) {
            toast.error('You have already reached the maximum edit limit of 3 changes.')
            return
        }

        setSubmitting(true)
        try {
            const advisorId = await getAdvisorId(allowedInfo.student_id)
            const labVal = selectedLab === 'none' ? null : (selectedLab || null)

            if (registration) {
                // Edit choice
                const newEditCount = (registration.student_edit_count || 0) + 1
                const { error } = await supabase.from('registrations').update({
                    section_id: selectedSection,
                    lab_group_id: labVal,
                    advisor_id: advisorId,
                    note: studentNote.trim(),
                    student_edit_count: newEditCount
                }).eq('id', registration.id)

                if (error) {
                    if (error.message.includes('row-level security policy') || error.message.includes('RLS')) {
                        toast.error('Unable to modify section. You have reached your limit of 3 changes.')
                    } else {
                        toast.error(error.message.includes('full') ? 'Section capacity full.' : error.message)
                    }
                } else {
                    // Audit Log
                    const { data: secData } = await supabase.from('sections').select('name').eq('id', selectedSection).single()
                    await supabase.from('audit_logs').insert({
                        user_id: user.id,
                        role: 'student',
                        action: 'EDIT',
                        note: `Student modified registration (${newEditCount}/3): ${allowedInfo.name} (${allowedInfo.student_id}) updated section to ${secData?.name}`
                    })

                    toast.success('Section choices updated successfully!')
                    await invalidateCacheScopes(['home', 'admin'])
                    await refreshData()
                }
            } else {
                // First time register
                const { error } = await supabase.from('registrations').insert({
                    student_name: allowedInfo.name,
                    student_id: allowedInfo.student_id,
                    section_id: selectedSection,
                    lab_group_id: labVal,
                    advisor_id: advisorId,
                    entered_by: user.id,
                    note: studentNote.trim(),
                    student_edit_count: 0
                })

                if (error) {
                    toast.error(error.message.includes('full') ? 'Section capacity full.' : error.message)
                } else {
                    // Audit Log
                    const { data: secData } = await supabase.from('sections').select('name').eq('id', selectedSection).single()
                    await supabase.from('audit_logs').insert({
                        user_id: user.id,
                        role: 'student',
                        action: 'ADD',
                        note: `Student self-registered: ${allowedInfo.name} (${allowedInfo.student_id}) selected section ${secData?.name}`
                    })

                    toast.success('Registration successful!')
                    await invalidateCacheScopes(['home', 'admin'])
                    await refreshData()
                }
            }
        } catch (err: any) {
            toast.error(err.message || 'An unexpected error occurred.')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/')
    }

    if (loading) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm font-semibold text-slate-500">Loading Student Portal...</p>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-6xl">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Student Portal</h1>
                    <p className="text-muted-foreground mt-1">Manage your section preferences for the active semester.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge className="px-3 py-1 font-bold text-sm bg-blue-50 text-blue-700 border-blue-200">
                        Semester: {semester?.name || 'None'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={handleLogout} className="text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900">
                        <LogOut className="h-4 w-4 mr-2" /> Log out
                    </Button>
                </div>
            </div>

            {/* Profile & Action Card Layout */}
            <div className="grid md:grid-cols-3 gap-6">
                {/* Unified Section Selection/Modification - Left 2/3 column */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="border border-slate-100 shadow-md">
                        <CardHeader className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b pb-4">
                            <CardTitle className="text-xl font-bold flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-blue-600" />
                                    Choose Your Section Choice
                                </span>
                                {registration && (
                                    <Badge variant={registration.advisor_completed ? 'default' : 'secondary'} className={registration.advisor_completed ? 'bg-green-600 text-white' : 'bg-amber-100 text-amber-800 border-amber-200'}>
                                        {registration.advisor_completed ? 'Approved by Advisor' : 'Pending Advisor Approval'}
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription>Select your desired section and lab group below.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            {/* Warning alert when limit is reached */}
                            {registration && registration.student_edit_count >= 3 ? (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-800 text-sm">
                                    <ShieldAlert className="h-5 w-5 flex-shrink-0 text-red-600" />
                                    <div>
                                        <p className="font-bold text-red-900">Change Limit Reached (3/3 edits)</p>
                                        <p className="mt-1">You have reached the maximum allowed limit of 3 section changes. You can no longer modify your selection. If you need any further changes, please contact your CR or assigned Advisor to modify on your behalf.</p>
                                    </div>
                                </div>
                            ) : semester?.is_locked ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-sm">
                                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                                    <div>
                                        <p className="font-bold">Semester Registration Locked</p>
                                        <p className="mt-1">Registration/updates are locked for this semester. Modifying choices is disabled.</p>
                                    </div>
                                </div>
                            ) : null}

                            <form onSubmit={handleRegisterOrEditSubmit} className="space-y-6">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold">Select Section</label>
                                        <Select 
                                            value={selectedSection} 
                                            onValueChange={handleSectionChange}
                                            disabled={submitting || (registration && registration.student_edit_count >= 3) || semester?.is_locked}
                                        >
                                            <SelectTrigger className="h-11">
                                                <SelectValue placeholder="Choose a section..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sections.map(sec => {
                                                    const isCurrentSec = registration && registration.section_id === sec.id;
                                                    const isFull = sec.current >= sec.capacity;
                                                    return (
                                                        <SelectItem 
                                                            key={sec.id} 
                                                            value={sec.id} 
                                                            disabled={isFull && !isCurrentSec}
                                                        >
                                                            Section {sec.name} ({sec.current}/{sec.capacity} filled) {isFull && !isCurrentSec ? '- FULL' : ''}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold">Select Lab Group (Optional)</label>
                                        <Select 
                                            value={selectedLab} 
                                            onValueChange={setSelectedLab} 
                                            disabled={!selectedSection || submitting || (registration && registration.student_edit_count >= 3) || semester?.is_locked}
                                        >
                                            <SelectTrigger className="h-11">
                                                <SelectValue placeholder="Choose lab group..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No Lab Group</SelectItem>
                                                {labGroups.map(lab => (
                                                    <SelectItem key={lab.id} value={lab.id}>
                                                        Lab {lab.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="sm:col-span-2 space-y-1.5">
                                        <label className="text-sm font-semibold">Message for Advisor (Optional)</label>
                                        <Textarea
                                            placeholder="Write any note about your request (e.g. section clash details)..."
                                            value={studentNote}
                                            onChange={e => setStudentNote(e.target.value)}
                                            rows={3}
                                            disabled={submitting || (registration && registration.student_edit_count >= 3) || semester?.is_locked}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border rounded-lg px-3 py-2">
                                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                                        <span>
                                            Changes Made: {registration?.student_edit_count || 0} / 3. Remaining: {3 - (registration?.student_edit_count || 0)}
                                        </span>
                                    </div>

                                    <Button 
                                        type="submit" 
                                        className="w-full sm:w-auto h-11 px-6 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all" 
                                        disabled={submitting || !selectedSection || (registration && registration.student_edit_count >= 3) || semester?.is_locked}
                                    >
                                        {submitting ? (
                                            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving Choice...</>
                                        ) : registration ? (
                                            <><CheckCircle2 className="h-4 w-4 mr-2" /> Update Section Choice</>
                                        ) : (
                                            <><CheckCircle2 className="h-4 w-4 mr-2" /> Register Section Choice</>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Assigned Advisor Info card (displays below form if registered) */}
                    {registration && (
                        <Card className="border border-slate-100 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                    <GraduationCap className="h-4 w-4 text-indigo-500" /> Advisor Feedback & Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 font-bold">
                                        {registration.advisors?.name?.substring(0, 2) || 'AD'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{registration.advisors?.name || 'Assigned Advisor'}</p>
                                        <p className="text-xs text-slate-500">{registration.advisors?.designation || 'Faculty Member'} | {registration.advisors?.email || 'N/A'}</p>
                                    </div>
                                </div>
                                
                                {registration.advisor_note ? (
                                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 mt-2">
                                        <p className="text-xs font-semibold text-amber-800 uppercase tracking-widest">Feedback from Advisor</p>
                                        <p className="text-sm text-amber-900 mt-1 italic font-medium">"{registration.advisor_note}"</p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">No feedback from advisor yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Profile Card & Info - Right 1/3 column */}
                <div className="md:col-span-1 space-y-6">
                    <Card className="border border-slate-100 shadow-sm bg-gradient-to-br from-slate-50 to-white">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Users className="h-5 w-5 text-blue-600" /> My Profile
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Full Name</p>
                                <p className="text-base font-bold text-slate-800">{allowedInfo?.name}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Student ID</p>
                                <p className="text-base font-mono font-semibold text-slate-800">{allowedInfo?.student_id}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Registered Email</p>
                                <p className="text-base text-slate-600 truncate">{allowedInfo?.email}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Live capacity directory */}
            <div className="space-y-4 pt-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" /> Live Section Status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {sections.map(sec => {
                        const pct = Math.round((sec.current / sec.capacity) * 100);
                        const isFull = sec.current >= sec.capacity;
                        const bar = pct >= 90 ? "from-rose-500 to-rose-600" : pct >= 70 ? "from-amber-400 to-amber-500" : "from-blue-500 to-blue-600";
                        const seatTone = isFull
                            ? "text-rose-700 bg-rose-50 border-rose-200"
                            : pct >= 70
                                ? "text-amber-700 bg-amber-50 border-amber-200"
                                : "text-blue-700 bg-blue-50 border-blue-200";
                        return (
                            <Card key={sec.id} className="border border-slate-100 shadow-sm bg-gradient-to-br from-white via-slate-50 to-emerald-50/20">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">Section {sec.name}</h3>
                                            <p className="text-xs text-slate-400">{semester?.name}</p>
                                        </div>
                                        <Badge className={`rounded-full px-3 border ${seatTone}`}>
                                            {sec.current}/{sec.capacity}
                                        </Badge>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div className={`h-full transition-all duration-500 bg-gradient-to-r ${bar}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between mt-2 text-xs">
                                        <span className="text-slate-500">{isFull ? "Section Full" : `${sec.capacity - sec.current} seats remaining`}</span>
                                        <span className={`px-2 py-0.5 rounded-full border ${seatTone}`}>{pct}% filled</span>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    )
}
