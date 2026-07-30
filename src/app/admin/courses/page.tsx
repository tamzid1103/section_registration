"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { BookOpen, Plus, Trash2, Download, Upload, Search, RefreshCw, ChevronLeft, Layers, FileText } from "lucide-react"
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

        const { error } = await supabase
            .from("offered_courses")
            .delete()
            .eq("semester_id", selectedSemesterId)

        if (error) {
            toast.error("Failed to clear courses: " + getFriendlyErrorMessage(error.message))
        } else {
            toast.success("All offered courses cleared for this semester.")
            setCourses([])
        }
    }

    async function handleBulkImport() {
        if (!selectedSemesterId) { toast.error("Select a semester first."); return }
        if (!bulkText.trim()) { toast.error("Please paste course lines."); return }

        setSubmitting(true)
        const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean)
        const toInsert: any[] = []

        for (const line of lines) {
            const parts = line.split(",").map(p => p.trim().replace(/^"|"$/g, ''))
            if (parts.length >= 2) {
                const code = parts[0].toUpperCase()
                const name = parts[1]
                const cred = parts[2] ? parseFloat(parts[2]) || 3.0 : 3.0
                toInsert.push({
                    semester_id: selectedSemesterId,
                    course_code: code,
                    course_name: name,
                    credit: cred
                })
            }
        }

        if (toInsert.length === 0) {
            toast.error("No valid lines found. Use format: COURSE_CODE, COURSE_NAME, CREDITS")
            setSubmitting(false)
            return
        }

        const { error } = await supabase.from("offered_courses").insert(toInsert)
        if (error) {
            toast.error("Bulk import failed: " + getFriendlyErrorMessage(error.message))
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
        setSubmitting(true)

        try {
            const text = await file.text()
            const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
            if (lines.length <= 1) {
                toast.error("CSV file is empty or missing data.")
                setSubmitting(false)
                return
            }

            const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
            const codeIdx = headers.findIndex(h => h.includes("code"))
            const nameIdx = headers.findIndex(h => h.includes("name"))
            const creditIdx = headers.findIndex(h => h.includes("credit"))

            const toInsert: any[] = []
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ''))
                const code = cols[codeIdx >= 0 ? codeIdx : 0]?.toUpperCase()
                const name = cols[nameIdx >= 0 ? nameIdx : 1]
                const cred = cols[creditIdx >= 0 ? creditIdx : 2] ? parseFloat(cols[creditIdx >= 0 ? creditIdx : 2]) || 3.0 : 3.0

                if (code && name) {
                    toInsert.push({
                        semester_id: selectedSemesterId,
                        course_code: code,
                        course_name: name,
                        credit: cred
                    })
                }
            }

            if (toInsert.length > 0) {
                const { error } = await supabase.from("offered_courses").insert(toInsert)
                if (error) {
                    toast.error("CSV Upload failed: " + getFriendlyErrorMessage(error.message))
                } else {
                    toast.success(`Imported ${toInsert.length} courses from CSV!`)
                    await fetchCoursesForSemester(selectedSemesterId)
                }
            } else {
                toast.error("No valid course rows parsed.")
            }
        } catch (err: any) {
            toast.error("Failed to read CSV: " + err.message)
        } finally {
            setSubmitting(false)
            if (csvRef.current) csvRef.current.value = ""
        }
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
        <div className="container mx-auto p-6 space-y-8 max-w-6xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/admin"><ChevronLeft className="h-4 w-4" /> Back</Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">Offered Courses</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">Manage course list for advisors and student reference.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Semester Selector */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 px-3">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Semester:</span>
                        <Select value={selectedSemesterId} onValueChange={handleSemesterChange}>
                            <SelectTrigger className="w-[180px] h-8 text-xs font-bold bg-white">
                                <SelectValue placeholder="Select semester..." />
                            </SelectTrigger>
                            <SelectContent>
                                {semesters.map(s => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs font-medium">
                                        {s.name} {s.is_active ? " (Active)" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2 text-slate-700">
                        <Download className="h-4 w-4" /> Export CSV
                    </Button>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Form column (Left 1/3) */}
                <div className="space-y-6">
                    <Card className="border border-slate-200 shadow-sm">
                        <CardHeader className="bg-slate-50 border-b pb-4">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Plus className="h-5 w-5 text-blue-600" /> Single Course Add
                            </CardTitle>
                            <CardDescription>Add a course to {currentSem?.name || "selected semester"}.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <form onSubmit={handleAddSingleCourse} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Course Code</label>
                                    <Input
                                        placeholder="e.g. CSE115"
                                        value={courseCode}
                                        onChange={e => setCourseCode(e.target.value)}
                                        className="h-10 font-mono uppercase"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Course Name</label>
                                    <Input
                                        placeholder="e.g. Programming Language I"
                                        value={courseName}
                                        onChange={e => setCourseName(e.target.value)}
                                        className="h-10"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Credit Hours</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="3.0"
                                        value={credit}
                                        onChange={e => setCredit(e.target.value)}
                                        className="h-10"
                                    />
                                </div>

                                <Button type="submit" disabled={submitting} className="w-full h-10 font-bold bg-blue-600 hover:bg-blue-700">
                                    {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                    Add Course
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Bulk operations card */}
                    <Card className="border border-slate-200 shadow-sm">
                        <CardHeader className="bg-slate-50 border-b pb-4">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Upload className="h-4 w-4 text-indigo-600" /> Bulk Import Courses
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start gap-2 h-10 font-medium">
                                        <FileText className="h-4 w-4 text-blue-600" /> Paste Course List
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>Bulk Paste Offered Courses</DialogTitle>
                                        <DialogDescription>
                                            Paste course lines in comma-separated format for {currentSem?.name}:<br />
                                            <code className="text-xs bg-slate-100 p-1 rounded font-mono">CODE, NAME, CREDITS</code>
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-2">
                                        <Textarea
                                            placeholder={`CSE115, Programming Language I, 3.0\nCSE115L, Programming Language I Lab, 1.0\nMAT110, Calculus & Geometry, 3.0`}
                                            value={bulkText}
                                            onChange={e => setBulkText(e.target.value)}
                                            rows={8}
                                            className="font-mono text-xs"
                                        />
                                        <Button onClick={handleBulkImport} disabled={submitting} className="w-full font-bold bg-blue-600">
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
                                <label htmlFor="csv-course-input" className="cursor-pointer">
                                    <Button variant="outline" className="w-full justify-start gap-2 h-10 font-medium pointer-events-none" asChild>
                                        <div><Upload className="h-4 w-4 text-emerald-600" /> Upload CSV File</div>
                                    </Button>
                                </label>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Table column (Right 2/3) */}
                <div className="md:col-span-2 space-y-4">
                    <Card className="border border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                            <div>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-blue-600" />
                                    Course List ({currentSem?.name})
                                </CardTitle>
                                <CardDescription>Showing all offered courses for this semester.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-blue-100 text-blue-800 font-bold px-3 py-1 text-sm border-blue-200">
                                    Total: {courses.length}
                                </Badge>
                                {courses.length > 0 && (
                                    <Button variant="ghost" size="sm" onClick={handleClearAllCourses} className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs">
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Filter input */}
                            <div className="relative">
                                <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                                <Input
                                    placeholder="Search by code or course name..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9 h-10"
                                />
                            </div>

                            {loading ? (
                                <div className="p-8 text-center text-slate-500 font-medium">Loading course catalog...</div>
                            ) : filteredCourses.length === 0 ? (
                                <div className="p-8 text-center border-2 border-dashed rounded-xl space-y-2">
                                    <Layers className="h-8 w-8 text-slate-400 mx-auto" />
                                    <p className="text-sm font-semibold text-slate-600">No courses offered yet for this semester.</p>
                                    <p className="text-xs text-slate-400">Use the form on the left or bulk import to add offered courses.</p>
                                </div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="w-[120px] font-bold">Code</TableHead>
                                                <TableHead className="font-bold">Course Title</TableHead>
                                                <TableHead className="w-[80px] font-bold text-center">Credits</TableHead>
                                                <TableHead className="w-[70px] text-right font-bold">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredCourses.map((c) => (
                                                <TableRow key={c.id} className="hover:bg-slate-50/80">
                                                    <TableCell className="font-mono font-bold text-blue-700">{c.course_code}</TableCell>
                                                    <TableCell className="font-medium text-slate-900">{c.course_name}</TableCell>
                                                    <TableCell className="text-center font-semibold text-slate-600">{c.credit}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteCourse(c.id, c.course_code)}
                                                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
