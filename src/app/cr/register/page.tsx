"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeStudentId } from "@/lib/advisor-assignment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserCheck, ShieldAlert } from "lucide-react";

interface Section {
    id: string;
    name: string;
    current_count: number;
    capacity: number;
}

interface Advisor {
    id: string;
    name: string;
    initial: string;
}

export default function CRRegisterPage() {
    const [loading, setLoading] = useState(false);
    const [fetchingAdvisor, setFetchingAdvisor] = useState(false);

    // Form State
    const [studentId, setStudentId] = useState("");
    const [studentName, setStudentName] = useState("");
    const [sectionId, setSectionId] = useState("");
    const [labId, setLabId] = useState("");
    const [assignedAdvisor, setAssignedAdvisor] = useState<Advisor | null>(null);
    const [sections, setSections] = useState<Section[]>([]);
    const [labs, setLabs] = useState<any[]>([]);

    // 1. Load Sections on Mount
    useEffect(() => {
        async function loadData() {
            // Get sections for current active semester
            const { data: semesterData } = await supabase
                .from("semesters")
                .select("id")
                .eq("is_active", true)
                .single();

            if (semesterData) {
                const { data: sectionData } = await supabase
                    .from("sections")
                    .select("id, name, capacity")
                    .eq("semester_id", semesterData.id);

                if (sectionData) {
                    // Count current registrations per section
                    const { data: regCounts } = await supabase
                        .from("registrations")
                        .select("section_id");

                    const formattedSections = sectionData.map(s => ({
                        id: s.id,
                        name: s.name,
                        capacity: s.capacity,
                        current_count: regCounts?.filter(r => r.section_id === s.id).length || 0
                    }));

                    setSections(formattedSections);
                }
            }
        }
        loadData();
    }, []);

    // 2. Auto-lookup Advisor when Student ID changes
    useEffect(() => {
        async function lookupAdvisor() {
            if (studentId.length < 8) {
                setAssignedAdvisor(null);
                return;
            }

            setFetchingAdvisor(true);
            const normalized = normalizeStudentId(studentId);

            // Query ranges using numeric comparison
            const numericId = parseInt(normalized);
            if (isNaN(numericId)) {
                setAssignedAdvisor(null);
                setFetchingAdvisor(false);
                return;
            }

            const { data: rangeData } = await supabase
                .from("student_advisor_ranges")
                .select(`
                  advisor_id,
                  advisors (id, name, initial)
                `)
                .lte("start_id_numeric", numericId)
                .gte("end_id_numeric", numericId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (rangeData && rangeData.length > 0) {
                const advisor = rangeData[0].advisors as any;
                setAssignedAdvisor({
                    id: advisor.id,
                    name: advisor.name,
                    initial: advisor.initial
                });
            } else {
                setAssignedAdvisor(null);
            }
            setFetchingAdvisor(false);
        }

        const timer = setTimeout(lookupAdvisor, 500);
        return () => clearTimeout(timer);
    }, [studentId]);

    // 3. Load Labs when Section changes
    useEffect(() => {
        async function loadLabs() {
            if (!sectionId) {
                setLabs([]);
                return;
            }
            const { data } = await supabase
                .from("lab_groups")
                .select("*")
                .eq("section_id", sectionId);
            if (data) setLabs(data);
        }
        loadLabs();
    }, [sectionId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase.from("registrations").insert({
                student_id: studentId,
                student_name: studentName,
                section_id: sectionId,
                lab_group_id: labId || null,
                advisor_id: assignedAdvisor?.id || null,
                entered_by: user?.id,
                note: ""
            });

            if (error) {
                if (error.code === '23505') throw new Error("This Student ID is already registered.");
                throw error;
            }

            toast.success("Student registered successfully!");
            // Reset form
            setStudentId("");
            setStudentName("");
            setSectionId("");
            setLabId("");
            setAssignedAdvisor(null);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-6">
            <Card className="shadow-xl border-none">
                <CardHeader className="bg-primary text-white rounded-t-xl">
                    <CardTitle className="text-2xl flex items-center gap-2">
                        <UserCheck className="w-6 h-6" /> Class Representative Portal
                    </CardTitle>
                    <CardDescription className="text-primary-foreground/80">
                        Advisory Pre-Registration Form
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6 pt-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Student ID */}
                            <div className="space-y-2">
                                <Label htmlFor="studentId">Student ID</Label>
                                <div className="relative">
                                    <Input
                                        id="studentId"
                                        placeholder="e.g. 231-15-123"
                                        value={studentId}
                                        onChange={(e) => setStudentId(e.target.value)}
                                        required
                                        className="pr-10"
                                    />
                                    {fetchingAdvisor && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-slate-400" />
                                    )}
                                </div>
                            </div>

                            {/* Student Name */}
                            <div className="space-y-2">
                                <Label htmlFor="studentName">Full Name</Label>
                                <Input
                                    id="studentName"
                                    placeholder="Student's Full Name"
                                    value={studentName}
                                    onChange={(e) => setStudentName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Advisor Auto-Display */}
                        <div className={`p-4 rounded-lg flex items-center justify-between transition-colors ${assignedAdvisor ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <ShieldAlert className={`w-5 h-5 ${assignedAdvisor ? 'text-green-600' : 'text-slate-400'}`} />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Assigned Advisor (Auto-detected)</p>
                                    <p className="font-bold text-slate-900">
                                        {assignedAdvisor ? `${assignedAdvisor.name} (${assignedAdvisor.initial})` : "Please enter a valid Student ID"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            {/* Section Select */}
                            <div className="space-y-2">
                                <Label>Preferred Theory Section</Label>
                                <Select value={sectionId} onValueChange={setSectionId} required>
                                    <SelectTrigger className="h-12">
                                        <SelectValue placeholder="Select Theory Section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map(s => {
                                            const isFull = s.current_count >= s.capacity;
                                            return (
                                                <SelectItem key={s.id} value={s.id} disabled={isFull}>
                                                    <div className="flex justify-between w-[250px]">
                                                        <span>Section {s.name}</span>
                                                        <span className={`text-xs ${isFull ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                                            {s.current_count}/{s.capacity} seats
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Lab Group Select */}
                            <div className="space-y-2">
                                <Label>Preferred Lab Group (Optional)</Label>
                                <Select value={labId} onValueChange={setLabId}>
                                    <SelectTrigger className="h-12">
                                        <SelectValue placeholder="Select Lab (Optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {labs.map(l => (
                                            <SelectItem key={l.id} value={l.id}>
                                                Group {l.name}
                                            </SelectItem>
                                        ))}
                                        {labs.length === 0 && <SelectItem value="none" disabled>No labs for this section</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="bg-slate-50 rounded-b-xl py-6 flex justify-between border-t mt-6">
                        <p className="text-xs text-slate-500 max-w-[250px]">
                            Confirming this registration will occupy one seat in the selected section.
                        </p>
                        <Button type="submit" className="h-12 px-8 gap-2" disabled={loading || !assignedAdvisor}>
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Complete Registration
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

