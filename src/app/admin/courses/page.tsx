"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { BookOpen, Plus, Trash2, Download, Upload, Search, RefreshCw, ArrowLeft, Layers, FileText, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { getFriendlyErrorMessage } from "@/lib/utils"
import Link from "next/link"

interface Semester {
    id: string
    name: string
    is_active: boolean
}

interface Course {
    id: string
    semester_id: string
    course_code: string
    course_name: string
    credit: number
    created_at: string
}

export default function AdminOfferedCoursesPage() {
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [semesters, setSemesters] = useState<Semester[]>([])
    const [selectedSemesterId, setSelectedSemesterId] = useState<string>("")
    const [courses, setCourses] = useState<Course[]>([])
    const [searchQuery, setSearchQuery] = useState("")

    // Form states
    const [courseCode, setCourseCode] = useState("")
    const [courseName, setCourseName] = useState("")
    const [credit, setCredit] = useState("3.0")

    // Bulk modal state
    const [bulkOpen, setBulkOpen] = useState(false)
    const [bulkText, setBulkText] = useState("")
    const csvRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        initSemesters()
    }, [])

    async function initSemesters() {
        setLoading(true)
        const { data: semData } = await supabase
            .from("semesters")
            .select("id, name, is_active")
            .order("created_at", { ascending: false })

        if (semData && semData.length > 0) {
            setSemesters(semData)
            const activeSem = semData.find(s => s.is_active) || semData[0]
            setSelectedSemesterId(activeSem.id)
            await fetchCoursesForSemester(activeSem.id)
        } else {
            setLoading(false)
        }
    }

    async function fetchCoursesForSemester(semesterId: string) {
        if (!semesterId) return
        setLoading(true)
        const { data, error } = await supabase
            .from("offered_courses")
            .select("*")
            .eq("semester_id", semesterId)
            .order("course_code", { ascending: true })

        if (error) {
            toast.error("Failed to load courses: " + getFriendlyErrorMessage(error.message))
        } else {
            setCourses(data || [])
        }
        setLoading(false)
    }

    async function handleSemesterChange(semId: string) {
        setSelectedSemesterId(semId)
        await fetchCoursesForSemester(semId)
    }

    async function handleAddSingleCourse(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedSemesterId) { toast.error("Please select a semester first."); return }
        if (!courseCode.trim() || !courseName.trim()) { toast.error("Please provide both Course Code and Course Name."); return }

        setSubmitting(true)
        const numCredit = parseFloat(credit) || 3.0

        const { error } = await supabase
            .from("offered_courses")
            .insert({
                semester_id: selectedSemesterId,
                course_code: courseCode.trim().toUpperCase(),
                course_name: courseName.trim(),
                credit: numCredit
            })

        if (error) {
            toast.error("Error adding course: " + getFriendlyErrorMessage(error.message))
        } else {
            toast.success(`Course ${courseCode.trim().toUpperCase()} added successfully!`)
            setCourseCode("")
            setCourseName("")
            setCredit("3.0")
            await fetchCoursesForSemester(selectedSemesterId)
        }
        setSubmitting(false)
    }

    async function handleDeleteCourse(id: string, code: string) {
        if (!confirm(`Are you sure you want to delete course ${code}?`)) return
        const { error } = await supabase
            .from("offered_courses")
            .delete()
            .eq("id", id)

        if (error) {
            toast.error("Error deleting course: " + getFriendlyErrorMessage(error.message))
        } else {
            toast.success(`Course ${code} deleted.`)
            setCourses(prev => prev.filter(c => c.id !== id))
        }
    }

    async function handleClearAllCourses() {
        const selectedSem = semesters.find(s => s.id === selectedSemesterId)
        if (!confirm(`Delete ALL offered courses for ${selectedSem?.name}? This action cannot be undone.`)) return

        setLoading(true)
        const { error } = await supabase
            .from("offered_courses")
            .delete()
            .eq("semester_id", selectedSemesterId)

        if (error) {
            toast.error("Error clearing courses: " + getFriendlyErrorMessage(error.message))
        } else {
            toast.success(`All courses for ${selectedSem?.name} deleted.`)
            setCourses([])
        }
        setLoading(false)
    }

    async function handleBulkImport() {
        if (!selectedSemesterId) { toast.error("Please select a semester."); return }
        if (!bulkText.trim()) { toast.error("Please paste course text."); return }

        setSubmitting(true)
        const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean)
        const toInsert: any[] = []

        for (const line of lines) {
            const parts = line.split(",").map(p => p.trim().replace(/^"|"$/g, ''))
            if (parts.length >= 2) {
                const code = parts[0].toUpperCase()
                const name = parts[1]
                const cred = parts[2] ? parseFloat(parts[2]) : 3.0
                if (code && name) {
                    toInsert.push({
                        semester_id: selectedSemesterId,
                        course_code: code,
                        course_name: name,
                        credit: isNaN(cred) ? 3.0 : cred
                    })
                }
            }
        }

        if (toInsert.length === 0) {
            toast.error("Could not parse course entries. Format: CODE, NAME, CREDITS")
            setSubmitting(false)
            return
        }

        const { error } = await supabase.from("offered_courses").insert(toInsert)
        if (error) {
            toast.error("Failed to import: " + getFriendlyErrorMessage(error.message))
        } else {
            toast.success(`Successfully imported ${toInsert.length} courses!`)
            setBulkText("")
            setBulkOpen(false)
            await fetchCoursesForSemester(selectedSemesterId)
        }
        setSubmitting(false)
    }

    async function handleCSVFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !selectedSemesterId) return

        const text = await file.text()
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
        const toInsert: any[] = []

        const startIndex = (lines[0].toLowerCase().includes("code") || lines[0].toLowerCase().includes("course")) ? 1 : 0

        for (let i = startIndex; i < lines.length; i++) {
            const parts = lines[i].split(",").map(p => p.trim().replace(/^"|"$/g, ''))
            if (parts.length >= 2) {
                const code = parts[0].toUpperCase()
                const name = parts[1]
                const cred = parts[2] ? parseFloat(parts[2]) : 3.0
                if (code && name) {
                    toInsert.push({
                        semester_id: selectedSemesterId,
                        course_code: code,
                        course_name: name,
                        credit: isNaN(cred) ? 3.0 : cred
                    })
                }
            }
        }

        if (toInsert.length === 0) {
            toast.error("No valid course rows found in CSV.")
            return
        }

        setLoading(true)
        const { error } = await supabase.from("offered_courses").insert(toInsert)
        if (error) {
            toast.error("Error uploading CSV: " + getFriendlyErrorMessage(error.message))
        } else {
            toast.success(`Uploaded ${toInsert.length} courses from CSV!`)
            await fetchCoursesForSemester(selectedSemesterId)
        }
        setLoading(false)
        if (csvRef.current) csvRef.current.value = ""
    }

    function exportToCSV() {
        if (courses.length === 0) { toast.error("No courses to export."); return }
        const currentSem = semesters.find(s => s.id === selectedSemesterId)
        const headers = ["Course Code", "Course Name", "Credit"]
        const rows = courses.map(c => [c.course_code, `"${c.course_name}"`, c.credit])
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `Offered_Courses_${currentSem?.name.replace(/\s+/g, '_') || 'Semester'}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        toast.success("Courses exported to CSV.")
    }

    const filteredCourses = courses.filter(c =>
        c.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.course_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const currentSem = semesters.find(s => s.id === selectedSemesterId)

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <Link 
                href="/admin" 
                className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to Admin Console
            </Link>

            {/* Header */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        Curriculum Catalog
                    </span>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Offered Courses Catalog</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Manage course codes, titles, and credit allocations per semester term.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Semester Selector */}
                    <div className="flex items-center gap-1.5 bg-muted/40 border border-border/70 rounded-xl p-1 px-2.5">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase hidden sm:inline">Semester:</span>
                        <Select value={selectedSemesterId} onValueChange={handleSemesterChange}>
                            <SelectTrigger className="w-[160px] h-7 text-xs font-medium bg-background border-border/60">
                                <SelectValue placeholder="Select semester..." />
                            </SelectTrigger>
                            <SelectContent>
                                {semesters.map(s => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs">
                                        {s.name} {s.is_active ? " (Active)" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button variant="outline" size="sm" onClick={exportToCSV} className="h-8 text-xs gap-1.5">
                        <Download className="w-3.5 h-3.5" /> Export
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form column (Left 1/3) */}
                <div className="space-y-6">
                    <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-4">
                        <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4 text-primary" />
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">Add Course</h3>
                                <p className="text-xs text-muted-foreground">To {currentSem?.name || "selected term"}.</p>
                            </div>
                        </div>

                        <form onSubmit={handleAddSingleCourse} className="space-y-3 pt-1">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Course Code *</label>
                                <Input
                                    placeholder="e.g. CSE115"
                                    value={courseCode}
                                    onChange={e => setCourseCode(e.target.value)}
                                    className="h-9 text-xs font-mono uppercase"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Course Title *</label>
                                <Input
                                    placeholder="e.g. Programming Language I"
                                    value={courseName}
                                    onChange={e => setCourseName(e.target.value)}
                                    className="h-9 text-xs"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Credits</label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    placeholder="3.0"
                                    value={credit}
                                    onChange={e => setCredit(e.target.value)}
                                    className="h-9 text-xs font-mono"
                                />
                            </div>

                            <Button type="submit" disabled={submitting} size="sm" className="w-full text-xs font-medium h-9">
                                {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                                Add Course
                            </Button>
                        </form>
                    </div>

                    {/* Bulk Operations Card */}
                    <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3">
                        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                            <Upload className="w-4 h-4 text-primary" /> Bulk Import Courses
                        </h3>
                        
                        <div className="space-y-2 pt-1">
                            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
                                        <FileText className="h-3.5 w-3.5 text-primary" /> Paste Course List
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-base font-semibold">Bulk Paste Offered Courses</DialogTitle>
                                        <DialogDescription className="text-xs">
                                            Paste lines in format: <code className="font-mono text-[10px] bg-muted px-1 rounded">CODE, NAME, CREDITS</code>
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-3 py-2">
                                        <Textarea
                                            placeholder={`CSE115, Programming Language I, 3.0\nCSE115L, Programming Language I Lab, 1.0\nMAT110, Calculus & Geometry, 3.0`}
                                            value={bulkText}
                                            onChange={e => setBulkText(e.target.value)}
                                            rows={8}
                                            className="font-mono text-xs resize-none"
                                        />
                                        <Button onClick={handleBulkImport} disabled={submitting} size="sm" className="w-full text-xs font-medium">
                                            {submitting ? "Importing..." : "Process Bulk Import"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".csv"
                                    ref={csvRef}
                                    onChange={handleCSVFileUpload}
                                    className="hidden"
                                    id="csv-course-input"
                                />
                                <label htmlFor="csv-course-input" className="cursor-pointer block">
                                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs pointer-events-none" asChild>
                                        <div><Upload className="h-3.5 w-3.5 text-primary" /> Upload CSV File</div>
                                    </Button>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table column (Right 2/3) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">Cataloged Courses</h3>
                                <p className="text-xs text-muted-foreground">{courses.length} courses offered for {currentSem?.name}.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {courses.length > 0 && (
                                    <Button variant="ghost" size="sm" onClick={handleClearAllCourses} className="text-destructive hover:bg-destructive/10 text-xs h-7">
                                        <Trash2 className="h-3 w-3 mr-1" /> Clear All
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-b border-border/60">
                            <div className="relative">
                                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Filter by code or course name..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-background"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="text-xs">
                                        <TableHead className="w-[110px] font-semibold">Code</TableHead>
                                        <TableHead className="font-semibold">Course Title</TableHead>
                                        <TableHead className="w-[80px] font-semibold text-center">Credits</TableHead>
                                        <TableHead className="w-[60px] text-right font-semibold">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-border/60">
                                    {filteredCourses.map((c) => (
                                        <TableRow key={c.id} className="text-xs hover:bg-muted/30">
                                            <TableCell className="font-mono font-bold text-primary py-3">{c.course_code}</TableCell>
                                            <TableCell className="font-medium text-foreground">{c.course_name}</TableCell>
                                            <TableCell className="text-center font-mono text-muted-foreground">{c.credit}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteCourse(c.id, c.course_code)}
                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredCourses.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic text-xs">
                                                {searchQuery ? "No matching courses found." : "No courses cataloged for this semester yet."}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
