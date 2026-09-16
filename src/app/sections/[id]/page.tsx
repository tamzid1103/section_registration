'use client'
import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ArrowLeft, Users, Sparkles, BookOpen, AlertCircle } from 'lucide-react'
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

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
                <div className="space-y-4 animate-pulse">
                    <div className="h-6 w-32 bg-muted rounded-md" />
                    <div className="h-10 w-64 bg-muted rounded-lg" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="h-72 bg-muted/60 rounded-2xl" />
                        <div className="h-72 bg-muted/60 rounded-2xl" />
                    </div>
                </div>
            </div>
        )
    }

    if (!section) {
        return (
            <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-semibold">Section Not Found</h2>
                <p className="text-sm text-muted-foreground">The requested section could not be found or may have been archived.</p>
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline pt-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Sections Directory
                </Link>
            </div>
        )
    }

    const totalStudents = Object.values(studentsByLab).flat().length
    const capacityPct = Math.round((totalStudents / (section.capacity || 50)) * 100)

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
            <Link 
                href="/" 
                className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to Sections Directory
            </Link>

            {/* Header section card */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                            {(section.semesters as any)?.name || 'Active Semester'}
                        </span>
                        <Badge variant="outline" className="text-xs font-mono">
                            ID: {section.id.slice(0, 8)}
                        </Badge>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Section {section.name}</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Official student enrollment roster and lab group assignments.
                    </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-border/60">
                    <div className="text-left sm:text-right">
                        <div className="text-xs text-muted-foreground">Total Enrollment</div>
                        <div className="text-2xl font-bold text-foreground">
                            {totalStudents} <span className="text-sm font-normal text-muted-foreground">/ {section.capacity}</span>
                        </div>
                    </div>
                    <div className="w-32 sm:w-28 bg-muted rounded-full h-2 overflow-hidden mt-1.5">
                        <div 
                            className={`h-full transition-all duration-300 ${
                                capacityPct >= 100 ? 'bg-destructive' : capacityPct >= 80 ? 'bg-amber-500' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, capacityPct)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Lab Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {labGroups.map(lg => {
                    const students = studentsByLab[lg.id] || []
                    const labLimit = lg.capacity || 25
                    const labPct = Math.round((students.length / labLimit) * 100)
                    const isFull = students.length >= labLimit

                    return (
                        <div key={lg.id} className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden flex flex-col">
                            {/* Card Header */}
                            <div className="px-5 py-4 border-b border-border/80 bg-muted/30 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                        {lg.name}
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-sm text-foreground">Lab Group {lg.name}</h2>
                                        <p className="text-[11px] text-muted-foreground">Cap limit: {labLimit} seats</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge 
                                        variant="outline" 
                                        className={`text-xs font-mono font-medium ${
                                            isFull 
                                                ? 'border-destructive/40 text-destructive bg-destructive/10' 
                                                : 'border-primary/30 text-primary bg-primary/5'
                                        }`}
                                    >
                                        {students.length}/{labLimit} {isFull ? '• FULL' : ''}
                                    </Badge>
                                </div>
                            </div>

                            {/* Roster List */}
                            <div className="divide-y divide-border/60 flex-1 overflow-y-auto max-h-[480px]">
                                {students.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground italic text-xs">
                                        No students registered in this lab yet.
                                    </div>
                                ) : (
                                    students.map((s, i) => (
                                        <div 
                                            key={s.id} 
                                            className={`px-4 py-3 flex flex-col gap-1 transition-colors hover:bg-muted/20 ${
                                                s.advisor_completed ? 'bg-primary/5' : ''
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="text-[11px] font-mono text-muted-foreground/60 w-5 text-right shrink-0">
                                                        {i + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-xs sm:text-sm text-foreground truncate">
                                                            {s.student_name}
                                                        </p>
                                                        <p className="text-[11px] font-mono text-muted-foreground">
                                                            {s.student_id}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    {s.advisors?.name && (
                                                        <span className="text-[11px] text-muted-foreground hidden sm:inline-block max-w-[120px] truncate">
                                                            Adv: {s.advisors.name}
                                                        </span>
                                                    )}
                                                    {s.advisor_completed ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                                            <CheckCircle2 className="w-3 h-3" /> Advised
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-muted-foreground/60">
                                                            Pending
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {s.advisor_note && (
                                                <div className="mt-1 ml-8 text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 rounded-md p-2">
                                                    <span className="font-semibold mr-1">Note:</span>
                                                    {s.advisor_note}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Unassigned Students fallback if any */}
            {studentsByLab['unassigned']?.length > 0 && (
                <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs">
                    <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Unassigned Lab Group</h3>
                    <div className="divide-y divide-border/60">
                        {studentsByLab['unassigned'].map(s => (
                            <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                                <span className="font-mono text-muted-foreground">{s.student_id}</span>
                                <span className="font-medium text-foreground">{s.student_name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
