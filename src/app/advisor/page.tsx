"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from "@/components/ui/dialog";
import { 
    Users, Search, CheckCircle2, Circle, LogOut, Download, Printer, 
    AlertTriangle, BookOpen, Mail, CalendarDays, Layers, Sparkles, Check, CheckCheck 
} from "lucide-react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/utils";
import { parseStudentIdNumeric } from "@/lib/advisor-assignment";
import { useRouter } from "next/navigation";

interface Student {
    id: string;
    student_id: string;
    student_name: string;
    section_name: string;
    lab_group_name: string;
    advisor_completed: boolean;
    advisor_note: string;
    created_at: string;
}

interface Semester {
    id: string;
    name: string;
    is_active: boolean;
    is_locked: boolean;
}

interface OfferedCourse {
    id: string;
    course_code: string;
    course_name: string;
    credit: number;
}

export default function AdvisorDashboard() {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [advisorInfo, setAdvisorInfo] = useState<{ id: string; name: string; ranges: any[] } | null>(null);
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
    const [offeredCourses, setOfferedCourses] = useState<OfferedCourse[]>([]);
    const [courseSearchQuery, setCourseSearchQuery] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("id");
    const [toggling, setToggling] = useState<string | null>(null);
    const [savingNote, setSavingNote] = useState<string | null>(null);
    const [showMissing, setShowMissing] = useState(false);
    const [crs, setCrs] = useState<any[]>([]);
    const router = useRouter();

    useEffect(() => {
        initAdvisorPortal();
        fetchCRs();
    }, []);

    async function fetchCRs() {
        const { data } = await supabase.from("cr_applications").select("*").eq("status", "approved");
        if (data) setCrs(data);
    }

    async function initAdvisorPortal() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            return;
        }

        const { data: advisorData } = await supabase
            .from("advisors")
            .select(`id, name, student_advisor_ranges(start_id, end_id)`)
            .eq("email", user.email)
            .single();

        if (!advisorData) {
            setLoading(false);
            return;
        }

        setAdvisorInfo({
            id: advisorData.id,
            name: advisorData.name,
            ranges: advisorData.student_advisor_ranges as any[],
        });

        // Fetch all semesters to populate selector (defaulting to active semester)
        const { data: semestersData } = await supabase
            .from("semesters")
            .select("id, name, is_active, is_locked")
            .order("created_at", { ascending: false });

        if (semestersData && semestersData.length > 0) {
            setSemesters(semestersData);
            const activeSem = semestersData.find(s => s.is_active) || semestersData[0];
            setSelectedSemesterId(activeSem.id);
            await fetchRegistrationsForSemester(advisorData.id, activeSem.id);
        } else {
            setLoading(false);
        }
    }

    async function fetchOfferedCoursesForSemester(semesterId: string) {
        const { data } = await supabase
            .from("offered_courses")
            .select("id, course_code, course_name, credit")
            .eq("semester_id", semesterId)
            .order("course_code", { ascending: true });

        setOfferedCourses(data || []);
    }

    async function fetchRegistrationsForSemester(advisorId: string, semesterId: string) {
        if (!advisorId || !semesterId) return;
        setLoading(true);

        fetchOfferedCoursesForSemester(semesterId);

        // 1. Fetch explicitly assigned registrations for this semester
        const { data: regData } = await supabase
            .from("registrations")
            .select(`
                id, 
                student_id, 
                student_name, 
                advisor_completed, 
                advisor_note, 
                timestamp, 
                sections!inner(name, semester_id), 
                lab_groups(name)
            `)
            .eq("advisor_id", advisorId)
            .eq("sections.semester_id", semesterId)
            .order("student_id", { ascending: true });

        // 2. Fallback: fetch registrations with null advisor_id in active semester that fall in advisor's ranges
        const { data: unassignedRegs } = await supabase
            .from("registrations")
            .select(`
                id, 
                student_id, 
                student_name, 
                advisor_completed, 
                advisor_note, 
                timestamp, 
                sections!inner(name, semester_id), 
                lab_groups(name)
            `)
            .is("advisor_id", null)
            .eq("sections.semester_id", semesterId);

        const assignedIds = new Set((regData || []).map((r: any) => r.id));
        const extraMatched: any[] = [];

        if (unassignedRegs && advisorInfo?.ranges && advisorInfo.ranges.length > 0) {
            for (const unreg of unassignedRegs) {
                if (assignedIds.has(unreg.id)) continue;
                const numId = parseStudentIdNumeric(unreg.student_id);
                if (numId === null) continue;

                const match = advisorInfo.ranges.find((r: any) => {
                    const start = parseStudentIdNumeric(r.start_id);
                    const end = parseStudentIdNumeric(r.end_id);
                    if (start === null || end === null) return false;
                    return numId >= start && numId <= end;
                });

                if (match) {
                    extraMatched.push(unreg);
                    // Silently backfill advisor_id so future queries find it immediately
                    await supabase.from("registrations").update({ advisor_id: advisorId }).eq("id", unreg.id);
                }
            }
        }

        const combined = [...(regData || []), ...extraMatched];
        combined.sort((a, b) => (a.student_id || "").localeCompare(b.student_id || ""));

        setStudents(
            combined.map((r: any) => ({
                id: r.id,
                student_id: r.student_id,
                student_name: r.student_name,
                section_name: r.sections?.name || "N/A",
                lab_group_name: r.lab_groups?.name || "—",
                advisor_completed: r.advisor_completed,
                advisor_note: r.advisor_note || "",
                created_at: new Date(r.timestamp).toLocaleDateString(),
            }))
        );
        setLoading(false);
    }

    async function handleSemesterChange(newSemId: string) {
        setSelectedSemesterId(newSemId);
        if (advisorInfo?.id) {
            await fetchRegistrationsForSemester(advisorInfo.id, newSemId);
        }
    }

    async function toggleCompletion(regId: string, current: boolean) {
        setToggling(regId);
        const { error } = await supabase
            .from("registrations")
            .update({ advisor_completed: !current })
            .eq("id", regId);

        if (error) {
            toast.error("Failed to update: " + getFriendlyErrorMessage(error.message));
        } else {
            toast.success(current ? "Marked as pending" : "Marked as completed ✓");
            setStudents(prev =>
                prev.map(s => s.id === regId ? { ...s, advisor_completed: !current } : s)
            );

            // Audit log
            const st = students.find(s => s.id === regId);
            const user = (await supabase.auth.getUser()).data.user;
            if (user) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    role: 'advisor',
                    action: 'EDIT',
                    note: `Advisor ${advisorInfo?.name || 'Unknown'} marked student ${st?.student_name || ''} (${st?.student_id || ''}) as ${!current ? 'Completed ✓' : 'Pending'}`
                });
            }
        }
        setToggling(null);
    }

    function updateLocalNote(regId: string, note: string) {
        setStudents(prev => prev.map(s => s.id === regId ? { ...s, advisor_note: note } : s));
    }

    async function saveNote(regId: string, note: string) {
        setSavingNote(regId);
        const { error } = await supabase
            .from("registrations")
            .update({ advisor_note: note.trim() })
            .eq("id", regId);

        if (error) {
            toast.error("Failed to save note: " + getFriendlyErrorMessage(error.message));
        } else {
            toast.success("Note saved");

            // Audit log
            const st = students.find(s => s.id === regId);
            const user = (await supabase.auth.getUser()).data.user;
            if (user) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    role: 'advisor',
                    action: 'EDIT',
                    note: `Advisor ${advisorInfo?.name || 'Unknown'} added note for student ${st?.student_name || ''} (${st?.student_id || ''}): "${note.trim()}"`
                });
            }
        }
        setSavingNote(null);
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        router.push("/auth/login");
    }

    function exportToCSV() {
        if (students.length === 0) {
            toast.error("No students to export.");
            return;
        }
        const headers = ["Student ID", "Full Name", "Section", "Lab Group", "Status", "Note", "Added Date"];
        const rows = sorted.map(s => [
            s.student_id,
            `"${s.student_name}"`,
            s.section_name,
            s.lab_group_name,
            s.advisor_completed ? "Completed" : "Pending",
            `"${s.advisor_note?.replace(/"/g, '""') || ''}"`,
            s.created_at
        ]);
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const semName = currentSemester?.name ? `_${currentSemester.name.replace(/\s+/g, '_')}` : '';
        link.setAttribute("download", `Students_List${semName}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV Downloaded successfully");
    }

    const filtered = students.filter(s =>
        s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.section_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === "id") return a.student_id.localeCompare(b.student_id);
        if (sortBy === "section") return a.section_name.localeCompare(b.section_name);
        if (sortBy === "done") return Number(b.advisor_completed) - Number(a.advisor_completed);
        if (sortBy === "pending") return Number(a.advisor_completed) - Number(b.advisor_completed);
        return 0;
    });

    const doneCount = students.filter(s => s.advisor_completed).length;

    const missingStudents = useMemo(() => {
        if (!advisorInfo || !advisorInfo.ranges) return [];
        const missing: string[] = [];
        const registeredIds = new Set(students.map(s => s.student_id));

        advisorInfo.ranges.forEach(range => {
            const startStr = String(range.start_id);
            const endStr = String(range.end_id);
            const startParts = startStr.split('-');
            const endParts = endStr.split('-');
            if (startParts.length === 3 && endParts.length === 3) {
                const prefix = `${startParts[0]}-${startParts[1]}-`;
                const startNum = parseInt(startParts[2], 10);
                const endNum = parseInt(endParts[2], 10);
                
                if (!isNaN(startNum) && !isNaN(endNum) && startNum <= endNum) {
                    for (let i = startNum; i <= endNum; i++) {
                        const rollLength = startParts[2].length;
                        const expectedId = `${prefix}${i.toString().padStart(rollLength, '0')}`;
                        if (!registeredIds.has(expectedId)) {
                            missing.push(expectedId);
                        }
                    }
                }
            }
        });
        return missing;
    }, [advisorInfo, students]);

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-6">
                <div className="h-20 bg-muted/50 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="h-28 bg-muted/40 rounded-2xl animate-pulse" />
                    <div className="h-28 bg-muted/40 rounded-2xl animate-pulse" />
                    <div className="h-28 bg-muted/40 rounded-2xl animate-pulse" />
                </div>
                <div className="h-64 bg-muted/30 rounded-2xl animate-pulse" />
            </div>
        );
    }

    if (!advisorInfo) {
        return (
            <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-semibold">Advisor Record Not Found</h1>
                <p className="text-xs text-muted-foreground">Your account email is not registered in the faculty advising directory.</p>
                <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">Logout</Button>
            </div>
        );
    }

    const currentSemester = semesters.find(s => s.id === selectedSemesterId);
    const progressPercent = students.length > 0 ? Math.round((doneCount / students.length) * 100) : 0;

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 print:py-0 print:px-0 print:space-y-4">
            {/* Top Bar Header */}
            <div className="bg-card border-2 border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:border-none print:p-0">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                            Faculty Advising
                        </span>
                        {currentSemester && (
                            <Badge variant={currentSemester.is_active ? "default" : "secondary"} className="text-xs font-bold">
                                {currentSemester.name} {currentSemester.is_active ? "• Active" : "• Archived"}
                            </Badge>
                        )}
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground">
                        Advising Roster: {advisorInfo.name}
                    </h1>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {advisorInfo.ranges.map((range: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[11px] font-mono text-muted-foreground bg-muted/30 border-border">
                                Range: {range.start_id} — {range.end_id}
                            </Badge>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center print:hidden">
                    {/* Semester Selector */}
                    <div className="flex items-center gap-1.5 bg-muted/40 border-2 border-border rounded-xl p-1 px-2.5">
                        <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-[11px] font-bold text-muted-foreground uppercase hidden sm:inline">Semester:</span>
                        <Select
                            value={selectedSemesterId}
                            onValueChange={(val) => handleSemesterChange(val)}
                        >
                            <SelectTrigger className="w-[150px] h-7 text-xs font-medium bg-background border border-border">
                                <SelectValue placeholder="Semester..." />
                            </SelectTrigger>
                            <SelectContent>
                                {semesters.map((sem) => (
                                    <SelectItem key={sem.id} value={sem.id} className="text-xs">
                                        {sem.name} {sem.is_active ? " (Active)" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                        <LogOut className="h-3.5 w-3.5 mr-1" /> Logout
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                {/* Total Assigned */}
                <div className="bg-card border-2 border-border rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-primary/40 transition-colors">
                    <div>
                        <p className="text-xs font-bold text-muted-foreground">Total Assigned</p>
                        <p className="text-2xl font-black text-foreground mt-1">{students.length}</p>
                        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Students in your ID ranges</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Users className="w-5 h-5" />
                    </div>
                </div>

                {/* Completed */}
                <div className="bg-card border-2 border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-muted-foreground">Advising Completed</p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{doneCount}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40">
                            <div 
                                className="bg-emerald-500 h-full transition-all duration-500 rounded-full" 
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 font-mono font-bold">{progressPercent}% complete</p>
                    </div>
                </div>

                {/* Remaining */}
                <div className="bg-card border-2 border-border rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-primary/40 transition-colors">
                    <div>
                        <p className="text-xs font-bold text-muted-foreground">Pending Attention</p>
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{students.length - doneCount}</p>
                        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Awaiting advising approval</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Circle className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Missing Students Alert */}
            {missingStudents.length > 0 && (
                <div className="print:hidden bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{missingStudents.length} expected student ID{missingStudents.length > 1 ? 's' : ''} have not registered yet</span>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs font-bold h-7 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                            onClick={() => setShowMissing(!showMissing)}
                        >
                            {showMissing ? 'Hide List' : 'View IDs'}
                        </Button>
                    </div>
                    {showMissing && (
                        <div className="mt-3 pt-3 border-t border-amber-500/20 flex flex-wrap gap-1.5">
                            {missingStudents.slice(0, 40).map(id => (
                                <Badge key={id} variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-900 dark:text-amber-200">
                                    {id}
                                </Badge>
                            ))}
                            {missingStudents.length > 40 && (
                                <span className="text-[11px] text-amber-700 dark:text-amber-400 self-center font-bold">
                                    + {missingStudents.length - 40} more
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Offered Courses Catalog */}
            <div className="bg-card border-2 border-border rounded-2xl shadow-xs overflow-hidden print:hidden">
                <div className="p-4 sm:p-5 border-b-2 border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary shrink-0" />
                        <div>
                            <h3 className="font-bold text-sm text-foreground">Offered Courses Catalog</h3>
                            <p className="text-xs text-muted-foreground font-medium">Reference course codes and credits for {currentSemester?.name || 'active semester'}.</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono ml-1 border-border font-bold">
                            {offeredCourses.length} Courses
                        </Badge>
                    </div>

                    <div className="relative w-full sm:w-60">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Filter course code or title..."
                            value={courseSearchQuery}
                            onChange={(e) => setCourseSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-background"
                        />
                    </div>
                </div>

                {offeredCourses.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-xs italic">
                        No offered courses cataloged for this semester.
                    </div>
                ) : (
                    <div className="max-h-52 overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-muted/30 sticky top-0 z-10">
                                <TableRow className="text-xs">
                                    <TableHead className="w-[120px] font-semibold py-2">Course Code</TableHead>
                                    <TableHead className="font-semibold py-2">Course Title</TableHead>
                                    <TableHead className="w-[80px] font-semibold text-center py-2">Credits</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-border/60">
                                {offeredCourses
                                    .filter(c =>
                                        c.course_code.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
                                        c.course_name.toLowerCase().includes(courseSearchQuery.toLowerCase())
                                    )
                                    .map((c) => (
                                        <TableRow key={c.id} className="text-xs hover:bg-muted/30">
                                            <TableCell className="font-mono font-bold text-primary py-2">{c.course_code}</TableCell>
                                            <TableCell className="font-medium text-foreground py-2">{c.course_name}</TableCell>
                                            <TableCell className="text-center font-mono text-muted-foreground py-2">{c.credit}</TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Student List Table Card */}
            <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
                <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                    <div>
                        <h3 className="font-semibold text-sm text-foreground">Assigned Students Roster</h3>
                        <p className="text-xs text-muted-foreground">Review registration details and mark advising completion.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-full sm:w-48">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search student..."
                                className="pl-8 h-8 text-xs bg-background"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[130px] h-8 text-xs bg-background">
                                <SelectValue placeholder="Sort" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="id">Student ID</SelectItem>
                                <SelectItem value="section">Section</SelectItem>
                                <SelectItem value="done">Completed First</SelectItem>
                                <SelectItem value="pending">Pending First</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Contact CRs Dialog */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Contact CRs</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl">
                                <DialogHeader>
                                    <DialogTitle className="text-base font-semibold flex items-center gap-2">
                                        <Users className="w-4 h-4 text-primary" /> Class Representatives Directory
                                    </DialogTitle>
                                    <DialogDescription className="text-xs">
                                        Approved CR contacts available for advising inquiries.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="divide-y divide-border/60 max-h-[60vh] overflow-y-auto">
                                    {crs.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-muted-foreground italic">
                                            No approved CRs found in the system.
                                        </div>
                                    ) : (
                                        crs.map((cr) => (
                                            <div key={cr.id} className="py-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                                                        {cr.full_name} 
                                                        <Badge variant="outline" className="text-[10px]">Sec {cr.section_interested}</Badge>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">ID: {cr.student_id}</p>
                                                </div>
                                                <a 
                                                    href={`mailto:${cr.email}`}
                                                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                                >
                                                    <Mail className="w-3.5 h-3.5" /> Email CR
                                                </a>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportToCSV}>
                            <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => window.print()}>
                            <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Print</span>
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table className="print:w-full print:text-xs">
                        <TableHeader className="bg-muted/30">
                            <TableRow className="text-xs">
                                <TableHead className="font-semibold">Student ID</TableHead>
                                <TableHead className="font-semibold">Full Name</TableHead>
                                <TableHead className="font-semibold">Section</TableHead>
                                <TableHead className="font-semibold">Lab</TableHead>
                                <TableHead className="font-semibold">Registered</TableHead>
                                <TableHead className="font-semibold">Advisor Note</TableHead>
                                <TableHead className="text-right font-semibold print:hidden">Status / Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/60">
                            {sorted.map((s) => (
                                <TableRow
                                    key={s.id}
                                    className={`text-xs hover:bg-muted/30 transition-colors ${s.advisor_completed ? "bg-primary/5" : ""}`}
                                >
                                    <TableCell className="font-mono font-medium text-foreground py-3">
                                        {s.student_id}
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground">
                                        <span className={s.advisor_completed ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}>
                                            {s.student_name}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[11px] font-mono">
                                            {s.section_name}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground font-mono">
                                        {s.lab_group_name}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-[11px]">
                                        {s.created_at}
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            placeholder="Add advising note..."
                                            className="h-7 text-xs min-w-[120px] max-w-[220px] print:hidden bg-background"
                                            value={s.advisor_note}
                                            onChange={(e) => updateLocalNote(s.id, e.target.value)}
                                            onBlur={() => saveNote(s.id, s.advisor_note)}
                                            disabled={savingNote === s.id}
                                        />
                                        <span className="hidden print:inline-block text-xs text-muted-foreground">
                                            {s.advisor_note || "—"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right print:hidden">
                                        <Button
                                            size="sm"
                                            variant={s.advisor_completed ? "outline" : "default"}
                                            className={`h-7 text-xs gap-1 font-medium ${
                                                s.advisor_completed
                                                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                                                    : ""
                                            }`}
                                            onClick={() => toggleCompletion(s.id, s.advisor_completed)}
                                            disabled={toggling === s.id}
                                        >
                                            {s.advisor_completed ? (
                                                <><Check className="h-3 w-3" /> Done</>
                                            ) : (
                                                <><Circle className="h-3 w-3" /> Mark Done</>
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {sorted.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground italic text-xs">
                                        {searchQuery ? "No matching students found." : "No students assigned to your advising ranges for this semester."}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
