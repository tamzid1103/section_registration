'use client'
import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ArrowLeft, Users } from 'lucide-react'
import Link from 'next/link'

export default function SectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [section, setSection] = useState<any>(null)
    const [labGroups, setLabGroups] = useState<any[]>([])
    const [studentsByLab, setStudentsByLab] = useState<Record<string, any[]>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const { data: sec } = await supabase
                .from('sections').select('*, semesters(name)').eq('id', id).single()
            setSection(sec)

            const { data: lgs } = await supabase
                .from('lab_groups').select('*').eq('section_id', id).order('name')
            setLabGroups(lgs || [])

            const { data: regs } = await supabase
                .from('registrations')
                .select('*, lab_groups(name), advisors(name)')
                .eq('section_id', id)
                .order('student_id')

            const byLab: Record<string, any[]> = { unassigned: [] }
            for (const r of (regs || [])) {
                const key = r.lab_group_id || 'unassigned'
                if (!byLab[key]) byLab[key] = []
                byLab[key].push(r)
            }
            setStudentsByLab(byLab)
            setLoading(false)
        }
        load()
    }, [id])

    if (loading) return <div className="p-10 text-center text-muted-foreground">Loading...</div>
    if (!section) return <div className="p-10 text-center text-red-500">Section not found.</div>

    const totalStudents = Object.values(studentsByLab).flat().length

    return (
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
            <Link href="/" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
            <div>
                <h1 className="text-3xl font-extrabold">Section {section.name}</h1>
                <p className="text-muted-foreground">{(section.semesters as any)?.name} · {totalStudents}/{section.capacity} students</p>
            </div>

            <div className="space-y-6">
                {labGroups.map(lg => {
                    const students = studentsByLab[lg.id] || []
                    return (
                        <div key={lg.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-500" /> Lab Group {lg.name}
                                </h2>
                                <Badge variant={students.length >= lg.capacity ? 'destructive' : 'secondary'}>
                                    {students.length}/{lg.capacity}
                                </Badge>
                            </div>
                            <div className="divide-y">
                                {students.length === 0 ? (
                                    <p className="text-center text-muted-foreground italic py-6 text-sm">No students yet.</p>
                                ) : students.map((s, i) => (
                                    <div key={s.id} className={`flex flex-col px-5 py-3 ${s.advisor_completed ? 'bg-green-50' : ''}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs text-slate-400 w-6">{i + 1}</span>
                                                <div>
                                                    <p className={`font-semibold text-sm ${s.advisor_completed ? 'text-green-700' : 'text-slate-800'}`}>{s.student_name}</p>
                                                    <p className="text-xs font-mono text-slate-500">{s.student_id}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {s.advisors?.name && (
                                                    <span className="text-xs text-slate-500 hidden md:block">Advisor: {s.advisors.name}</span>
                                                )}
                                                {s.advisor_completed && (
                                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                )}
                                            </div>
                                        </div>
                                        {s.advisor_note && (
                                            <div className="mt-2 ml-10 text-xs bg-amber-50/80 border border-amber-100 rounded p-2 text-slate-700">
                                                <span className="font-semibold text-amber-700 mr-1">Note:</span>
                                                {s.advisor_note}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
                {studentsByLab['unassigned']?.length > 0 && (
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-slate-50 border-b font-bold text-slate-600">No Lab Group Assigned</div>
                        {studentsByLab['unassigned'].map(s => (
                            <div key={s.id} className="flex px-5 py-3 border-b text-sm">
                                <span className="font-mono text-slate-500 mr-3">{s.student_id}</span>
                                <span>{s.student_name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
