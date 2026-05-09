"use client";

import { useState, useEffect } from "react";
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
import { Users, Search, CheckCircle2, Circle, LogOut } from "lucide-react";
import { toast } from "sonner";
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

export default function AdvisorDashboard() {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [advisorInfo, setAdvisorInfo] = useState<{ name: string; ranges: any[] } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("id");
    const [toggling, setToggling] = useState<string | null>(null);
    const [savingNote, setSavingNote] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchAdvisorData();
    }, []);

    async function fetchAdvisorData() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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
            name: advisorData.name,
            ranges: advisorData.student_advisor_ranges as any[],
        });

        const { data: regData } = await supabase
            .from("registrations")
            .select(`id, student_id, student_name, advisor_completed, advisor_note, timestamp, sections(name), lab_groups(name)`)
            .eq("advisor_id", advisorData.id)
            .order("student_id", { ascending: true });

        if (regData) {
            setStudents(
                regData.map((r: any) => ({
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
        }
        setLoading(false);
    }

    async function toggleCompletion(regId: string, current: boolean) {
        setToggling(regId);
        const { error } = await supabase
            .from("registrations")
            .update({ advisor_completed: !current })
            .eq("id", regId);

        if (error) {
            toast.error("Failed to update: " + error.message);
        } else {
            toast.success(current ? "Marked as pending" : "Marked as completed ✓");
            setStudents(prev =>
                prev.map(s => s.id === regId ? { ...s, advisor_completed: !current } : s)
            );
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
            toast.error("Failed to save note: " + error.message);
        } else {
            toast.success("Note saved");
        }
        setSavingNote(null);
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        router.push("/auth/login");
    }

    const filtered = students.filter(s =>
        s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.student_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === "id") return a.student_id.localeCompare(b.student_id);
        if (sortBy === "section") return a.section_name.localeCompare(b.section_name);
        if (sortBy === "done") return Number(b.advisor_completed) - Number(a.advisor_completed);
        if (sortBy === "pending") return Number(a.advisor_completed) - Number(b.advisor_completed);
        return 0;
    });

    const doneCount = students.filter(s => s.advisor_completed).length;

    if (loading) return <div className="p-10 text-center text-muted-foreground">Loading advisor console...</div>;

    if (!advisorInfo) {
        return (
            <div className="p-10 text-center space-y-4">
                <h1 className="text-2xl font-bold text-red-600">Advisor Record Not Found</h1>
                <p className="text-muted-foreground">Your email is not registered in the advisor list.</p>
                <Button variant="outline" onClick={handleLogout}>Logout</Button>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-10 px-6 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome, {advisorInfo.name}</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Mark students as completed once you finish their advising session.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {advisorInfo.ranges.map((range: any, i: number) => (
                            <Badge key={i} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Range: {range.start_id} — {range.end_id}
                            </Badge>
                        ))}
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 self-start">
                    <LogOut className="h-4 w-4" /> Logout
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                        <Users className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{students.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{doneCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Remaining</CardTitle>
                        <Circle className="w-4 h-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{students.length - doneCount}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Student Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Student List</CardTitle>
                            <CardDescription>Mark each student when their advising is done.</CardDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative w-56">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by ID or Name"
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="id">Student ID</SelectItem>
                                    <SelectItem value="section">Section</SelectItem>
                                    <SelectItem value="done">Completed First</SelectItem>
                                    <SelectItem value="pending">Pending First</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student ID</TableHead>
                                <TableHead>Full Name</TableHead>
                                <TableHead>Section</TableHead>
                                <TableHead>Lab Group</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Note</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sorted.map((s) => (
                                <TableRow
                                    key={s.id}
                                    className={s.advisor_completed ? "bg-green-50/60" : ""}
                                >
                                    <TableCell className="font-mono text-sm font-medium">
                                        {s.student_id}
                                    </TableCell>
                                    <TableCell>
                                        <span className={s.advisor_completed ? "text-green-700 font-semibold" : ""}>
                                            {s.student_name}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">Section {s.section_name}</Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{s.lab_group_name}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{s.created_at}</TableCell>
                                    <TableCell>
                                        <Input
                                            placeholder="Add note..."
                                            className="h-8 text-sm min-w-[120px] max-w-[200px]"
                                            value={s.advisor_note}
                                            onChange={(e) => updateLocalNote(s.id, e.target.value)}
                                            onBlur={() => saveNote(s.id, s.advisor_note)}
                                            disabled={savingNote === s.id}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant={s.advisor_completed ? "outline" : "default"}
                                            className={s.advisor_completed
                                                ? "border-green-500 text-green-700 hover:bg-green-50 gap-1"
                                                : "gap-1"}
                                            onClick={() => toggleCompletion(s.id, s.advisor_completed)}
                                            disabled={toggling === s.id}
                                        >
                                            {s.advisor_completed
                                                ? <><CheckCircle2 className="h-3.5 w-3.5" /> Done</>
                                                : <><Circle className="h-3.5 w-3.5" /> Mark Done</>
                                            }
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {sorted.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                        No students found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
