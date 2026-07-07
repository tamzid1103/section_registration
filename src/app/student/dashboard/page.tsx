'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Users, BookOpen, Clock, LogOut, CheckCircle2, AlertTriangle, RefreshCw, GraduationCap, Edit, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { invalidateCacheScopes } from '@/lib/cache/client'

export default function StudentDashboard() {
    const supabase = createClient()
    const router = useRouter()

    const [loading, setLoading] = useState(true)
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

    // Edit modal states
    const [editOpen, setEditOpen] = useState(false)
    const [editSection, setEditSection] = useState('')
    const [editLab, setEditLab] = useState('')
    const [editLabGroups, setEditLabGroups] = useState<any[]>([])
    const [editNote, setEditNote] = useState('')

    useEffect(() => {
        init()

        // Realtime updates
        const regCh = supabase.channel('student-reg-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
                fetchStudentData()
                fetchSections()
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
            // Load sections and current registrations
            await Promise.all([
                fetchStudentRegistration(allowed.student_id),
                fetchSections(sem.id)
            ])
        }

        setLoading(false)
    }

    async function fetchStudentRegistration(studentId: string) {
        const { data } = await supabase
            .from('registrations')
            .select('*, sections(name), lab_groups(name), advisors(name, email, designation)')
            .eq('student_id', studentId)
            .maybeSingle()
        setRegistration(data)

        if (data) {
            setEditSection(data.section_id || '')
            setEditLab(data.lab_group_id || '')
            setEditNote(data.note || '')
            if (data.section_id) {
                fetchEditLabGroups(data.section_id)
            }
        }
    }

    async function fetchStudentData() {
        if (!allowedInfo) return
        await fetchStudentRegistration(allowedInfo.student_id)
    }

    async function fetchSections(semId?: string) {
        const targetSemId = semId || semester?.id
        if (!targetSemId) return

        const { data } = await supabase
            .from('sections')
            .select('*, registrations(id)')
            .eq('semester_id', targetSemId)
            .order('name')

        if (data) {
            const parsed = data.map(sec => ({
                ...sec,
                current: sec.registrations ? sec.registrations.length : 0
            }))
            setSections(parsed)
        }
    }

    async function handleSectionChange(secId: string, isEdit: boolean) {
        if (isEdit) {
            setEditSection(secId)
            setEditLab('')
        } else {
            setSelectedSection(secId)
            setSelectedLab('')
        }

        const { data } = await supabase
            .from('lab_groups')
            .select('*')
            .eq('section_id', secId)
            .order('name')

        if (isEdit) {
            setEditLabGroups(data || [])
        } else {
            setLabGroups(data || [])
        }
    }

    async function fetchEditLabGroups(secId: string) {
        const { data } = await supabase
            .from('lab_groups')
            .select('*')
            .eq('section_id', secId)
            .order('name')
        setEditLabGroups(data || [])
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

    // Initial Registration Submit
    async function handleRegisterSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedSection) { toast.error('Please select a section.'); return }
        if (semester?.is_locked) { toast.error('This semester is locked. Updates are disabled.'); return }

        setLoading(true)
        const advisorId = await getAdvisorId(allowedInfo.student_id)

        const { error } = await supabase.from('registrations').insert({
            student_name: allowedInfo.name,
            student_id: allowedInfo.student_id,
            section_id: selectedSection,
            lab_group_id: selectedLab || null,
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
            init()
        }
        setLoading(false)
    }

    // Modify/Edit Submit
    async function handleEditSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!editSection) { toast.error('Please select a section.'); return }
        if (semester?.is_locked) { toast.error('This semester is locked. Updates are disabled.'); return }
        if (registration && registration.student_edit_count >= 2) {
            toast.error('You have already reached the maximum edit limit of 2 changes.')
            return
        }

        setLoading(true)
        const advisorId = await getAdvisorId(allowedInfo.student_id)
        const newEditCount = (registration?.student_edit_count || 0) + 1

        const { error } = await supabase.from('registrations').update({
            section_id: editSection,
            lab_group_id: editLab || null,
            advisor_id: advisorId,
            note: editNote.trim(),
            student_edit_count: newEditCount
        }).eq('id', registration.id)

        if (error) {
            toast.error(error.message.includes('full') ? 'Section capacity full.' : error.message)
        } else {
            // Audit Log
            const { data: secData } = await supabase.from('sections').select('name').eq('id', editSection).single()
            await supabase.from('audit_logs').insert({
                user_id: user.id,
                role: 'student',
                action: 'EDIT',
                note: `Student modified registration (${newEditCount}/2): ${allowedInfo.name} (${allowedInfo.student_id}) updated section to ${secData?.name}`
            })

            toast.success('Section choices updated successfully!')
            setEditOpen(false)
            await invalidateCacheScopes(['home', 'admin'])
            init()
        }
        setLoading(false)
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

            {/* Profile info cards */}
            <div className="grid md:grid-cols-3 gap-6">
                {/* Profile Card */}
                <Card className="md:col-span-1 border border-slate-100 shadow-sm bg-gradient-to-br from-slate-50 to-white">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" /> My Profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
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

                {/* Main Registration Panel */}
                <Card className="md:col-span-2 border border-slate-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold flex items-center justify-between">
                            <span>Registration Status</span>
                            {registration && (
                                <Badge variant={registration.advisor_completed ? 'default' : 'secondary'} className={registration.advisor_completed ? 'bg-green-600 text-white' : 'bg-amber-100 text-amber-800 border-amber-200'}>
                                    {registration.advisor_completed ? 'Advised & Approved' : 'Approval Pending'}
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>Review or set your section details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {registration ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4 border rounded-xl p-5 bg-slate-50/50">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Section</p>
                                        <p className="text-lg font-extrabold text-slate-900">Section {registration.sections?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Lab Group</p>
                                        <p className="text-lg font-bold text-slate-900">{registration.lab_groups?.name || 'None Selected'}</p>
                                    </div>
                                    <div className="col-span-2 border-t pt-3 mt-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <GraduationCap className="h-4 w-4 text-blue-500" /> Assigned Advisor
                                        </p>
                                        {registration.advisors ? (
                                            <div>
                                                <p className="text-base font-bold text-slate-800">{registration.advisors.name}</p>
                                                <p className="text-xs text-slate-500">{registration.advisors.designation || 'Faculty Member'} | {registration.advisors.email}</p>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic">No advisor range matched.</p>
                                        )}
                                    </div>
                                    {registration.note && (
                                        <div className="col-span-2 border-t pt-3 mt-1">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">My Note</p>
                                            <p className="text-sm text-slate-600 bg-white p-2 rounded-lg border border-slate-100 italic mt-1">"{registration.note}"</p>
                                        </div>
                                    )}
                                    {registration.advisor_note && (
                                        <div className="col-span-2 border-t pt-3 mt-1 bg-amber-50/40 p-3 rounded-lg border border-amber-100">
                                            <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Advisor Feedback</p>
                                            <p className="text-sm text-amber-800 mt-1">"{registration.advisor_note}"</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-xl">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                            <Clock className="h-4 w-4 text-blue-600" /> Change Section limit
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            You can modify your section choice at most 2 times. Remaining changes: <strong>{2 - registration.student_edit_count}</strong>.
                                        </p>
                                    </div>

                                    {registration.student_edit_count < 2 && !semester?.is_locked ? (
                                        <Button onClick={() => setEditOpen(true)} className="w-full sm:w-auto">
                                            <Edit className="h-4 w-4 mr-2" /> Modify Section
                                        </Button>
                                    ) : (
                                        <Badge className="bg-red-50 text-red-700 border-red-200 py-1.5 px-3 flex gap-1.5 items-center">
                                            <ShieldAlert className="h-4 w-4 shrink-0" /> Edit Limit Reached / Semester Locked
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleRegisterSubmit} className="space-y-6">
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-sm">
                                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                                    <p>You have not registered for any section yet. Choose your preferred section below. Make sure to check the live section capacity before submitting.</p>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold">Select Section</label>
                                        <Select value={selectedSection} onValueChange={(v) => handleSectionChange(v, false)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Choose a section..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sections.map(sec => (
                                                    <SelectItem key={sec.id} value={sec.id} disabled={sec.current >= sec.capacity}>
                                                        Section {sec.name} ({sec.current}/{sec.capacity} filled) {sec.current >= sec.capacity ? '- FULL' : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold">Select Lab Group (Optional)</label>
                                        <Select value={selectedLab} onValueChange={setSelectedLab} disabled={!selectedSection}>
                                            <SelectTrigger>
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
                                            placeholder="Any note about section request or clash..."
                                            value={studentNote}
                                            onChange={e => setStudentNote(e.target.value)}
                                            rows={3}
                                        />
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={!selectedSection}>
                                    <CheckCircle2 className="h-5 w-5 mr-2" /> Register Section Choice
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Live capacity directory */}
            <div className="space-y-4">
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

            {/* Change Section Modal */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Modify Section Registration</DialogTitle>
                    </DialogHeader>
                    {registration && (
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                                You are modifying your choice. This counts as change <strong>{(registration.student_edit_count || 0) + 1} of 2</strong>.
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Select Section</label>
                                <Select value={editSection} onValueChange={(v) => handleSectionChange(v, true)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a section..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map(sec => (
                                            <SelectItem key={sec.id} value={sec.id} disabled={sec.current >= sec.capacity && sec.id !== registration.section_id}>
                                                Section {sec.name} ({sec.current}/{sec.capacity} filled) {sec.current >= sec.capacity && sec.id !== registration.section_id ? '- FULL' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Select Lab Group (Optional)</label>
                                <Select value={editLab} onValueChange={setEditLab} disabled={!editSection}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose lab group..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Lab Group</SelectItem>
                                        {editLabGroups.map(lab => (
                                            <SelectItem key={lab.id} value={lab.id}>
                                                Lab {lab.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Message for Advisor (Optional)</label>
                                <Textarea
                                    placeholder="Any note about section request or clash..."
                                    value={editNote}
                                    onChange={e => setEditNote(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <DialogFooter className="gap-2">
                                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={!editSection}>Save Choice</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
