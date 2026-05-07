"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2, User, BookOpen, GraduationCap, Users, CheckCircle2, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function StudentHub() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch live section occupancy
    useEffect(() => {
        const fetchSections = async () => {
            const { data } = await supabase
                .from("sections")
                .select("id, name, capacity, semester_id, semesters(name, is_active)")
                .order("name");
            if (data) {
                const { data: regs } = await supabase.from("registrations").select("section_id");
                const withCount = data.map(s => ({
                    ...s,
                    current_students: regs?.filter(r => r.section_id === s.id).length || 0,
                    max_students: s.capacity,
                }));
                setSections(withCount);
            }
        };

        fetchSections();

        const channel = supabase
            .channel("home-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, fetchSections)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // Search logic
    useEffect(() => {
        const search = async () => {
            if (query.length < 3) { setResults([]); return; }
            setLoading(true);
            const { data } = await supabase
                .from("registrations")
                .select(`*, sections(name), advisors(name)`)
                .or(`student_id.ilike.%${query}%,student_name.ilike.%${query}%`)
                .limit(5);
            if (data) setResults(data);
            setLoading(false);
        };
        const t = setTimeout(search, 500);
        return () => clearTimeout(t);
    }, [query]);

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Header */}
            <div className="bg-[#2563EB] text-white pt-16 pb-24 px-6 text-center relative">
                <h1 className="text-4xl font-extrabold tracking-tight mb-4">DIU Section Pre-Registration</h1>
                <p className="max-w-xl mx-auto text-blue-100 opacity-90">
                    Check real-time section availability and your registration status.
                </p>
                <Link
                    href="/auth/login"
                    className="absolute top-4 right-6 flex items-center gap-1.5 text-blue-100 hover:text-white text-sm border border-blue-300 hover:border-white rounded-lg px-3 py-1.5 transition-colors"
                >
                    <LogIn className="w-4 h-4" /> Staff Login
                </Link>
            </div>

            <div className="max-w-6xl mx-auto px-6 -mt-12 space-y-8 pb-20">
                {/* Search Bar */}
                <div className="relative max-w-2xl mx-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <Input
                        className="h-14 pl-12 pr-4 text-lg bg-white shadow-xl border-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl"
                        placeholder="Search your Student ID or Name..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {loading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Loader2 className="animate-spin text-blue-600 w-5 h-5" />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Section Live Status */}
                    <div className="lg:col-span-8 space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                            <Users className="w-5 h-5 text-blue-600" /> Live Section Status
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {sections.length > 0 ? sections.map((section) => {
                                const pct = Math.round((section.current_students / section.max_students) * 100);
                                const isFull = section.current_students >= section.max_students;
                                const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-blue-500";
                                return (
                                    <Card key={section.id} className="border-none shadow-sm hover:shadow-md transition-all bg-white">
                                        <CardContent className="p-5">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">Section {section.name}</h3>
                                                    <p className="text-xs text-slate-400">{(section.semesters as any)?.name}</p>
                                                </div>
                                                <Badge
                                                    variant={isFull ? "destructive" : "secondary"}
                                                    className="rounded-full px-3 py-1"
                                                >
                                                    {section.current_students}/{section.max_students}
                                                </Badge>
                                            </div>
                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2 font-medium">
                                                {isFull ? "Section Full" : `${section.max_students - section.current_students} seats remaining`}
                                            </p>
                                        </CardContent>
                                    </Card>
                                );
                            }) : (
                                <div className="col-span-2 text-center py-10 text-slate-400">Loading sections...</div>
                            )}
                        </div>
                    </div>

                    {/* Search Results */}
                    <div className="lg:col-span-4 space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                            <User className="w-5 h-5 text-blue-600" /> Your Info
                        </h2>
                        {query.length >= 3 ? (
                            <div className="space-y-4">
                                {results.length > 0 ? results.map((reg) => (
                                    <Card
                                        key={reg.id}
                                        className={`border-l-4 shadow-lg bg-white border-none ${reg.advisor_completed ? "border-l-green-500" : "border-l-blue-600"}`}
                                    >
                                        <CardContent className="p-5 space-y-4">
                                            {reg.advisor_completed && (
                                                <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Advisor Pre-Registration Completed
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</span>
                                                <span className="text-lg font-bold text-slate-900">{reg.student_name}</span>
                                                <span className="text-sm font-mono text-slate-500">{reg.student_id}</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 border-t pt-3">
                                                <div className="flex items-center gap-3">
                                                    <BookOpen className="w-4 h-4 text-blue-500" />
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-400">Assigned Section</p>
                                                        <p className="text-sm font-bold">Section {reg.sections?.name}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <GraduationCap className="w-4 h-4 text-blue-500" />
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-400">Assigned Advisor</p>
                                                        <p className="text-sm font-bold text-slate-700">
                                                            {reg.advisors?.name || "Not assigned yet"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )) : (
                                    <div className="bg-white p-8 rounded-2xl border-2 border-dashed text-center">
                                        <p className="text-slate-400 text-sm">No record found for &quot;{query}&quot;</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-center">
                                <p className="text-blue-600/60 text-sm italic font-medium">
                                    Enter your ID or name to check section &amp; advisor assignment.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
