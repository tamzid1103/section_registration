"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, BookOpen, GraduationCap, Users, CheckCircle2, LogIn, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function StudentHub() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [advisors, setAdvisors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [dashboardUrl, setDashboardUrl] = useState("/auth/login");

    useEffect(() => {
        fetchData();
        // Check if logged in
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user?.email) return;
            supabase.from("authorized_staff").select("role").eq("email", user.email).maybeSingle()
                .then(({ data }) => {
                    if (data?.role) {
                        setUserRole(data.role);
                        const map: Record<string, string> = { developer: '/developer', admin: '/admin', advisor: '/advisor', cr: '/cr/manage' };
                        setDashboardUrl(map[data.role] || '/auth/login');
                    }
                });
        });

        const channel = supabase.channel("home-rt")
            .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, fetchData)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchData() {
        const { data: secs } = await supabase
            .from("sections")
            .select("id, name, capacity, semester_id, semesters!inner(name, is_active)")
            .eq("semesters.is_active", true)
            .order("name");
        const { data: regs } = await supabase.from("registrations").select("section_id");
        const { data: advs } = await supabase.from("advisors")
            .select("id, name, email, phone, designation, student_advisor_ranges(start_id, end_id)")
            .order("name");

        if (secs) {
            setSections(secs.map(s => ({
                ...s,
                current: regs?.filter(r => r.section_id === s.id).length || 0
            })));
        }
        if (advs) setAdvisors(advs);
    }

    useEffect(() => {
        const search = async () => {
            if (query.length < 3) { setResults([]); return; }
            setLoading(true);
            const { data } = await supabase
                .from("registrations")
                .select("*, sections(name, id), lab_groups(name), advisors(name, phone, designation)")
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
                <h1 className="text-4xl font-extrabold tracking-tight mb-3">DIU Section Pre-Registration</h1>
                <p className="max-w-xl mx-auto text-blue-100 opacity-90">Check real-time section availability and your registration status.</p>

                <div className="absolute top-4 right-6 flex items-center gap-2">
                    {userRole ? (
                        <Link href={dashboardUrl}
                            className="flex items-center gap-1.5 bg-white text-blue-700 font-semibold text-sm rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors shadow-sm">
                            <LayoutDashboard className="w-4 h-4" /> Dashboard
                        </Link>
                    ) : (
                        <Link href="/auth/login"
                            className="flex items-center gap-1.5 text-blue-100 hover:text-white text-sm border border-blue-300 hover:border-white rounded-lg px-3 py-1.5 transition-colors">
                            <LogIn className="w-4 h-4" /> Staff Login
                        </Link>
                    )}
                    <a href="#advisors"
                        className="flex items-center gap-1.5 text-blue-100 hover:text-white text-sm border border-blue-300 hover:border-white rounded-lg px-3 py-1.5 transition-colors">
                        <GraduationCap className="w-4 h-4" /> Advisors
                    </a>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 -mt-12 space-y-10 pb-20">
                {/* Search */}
                <div className="relative max-w-2xl mx-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <Input
                        className="h-14 pl-12 text-lg bg-white shadow-xl border-none rounded-2xl focus-visible:ring-2 focus-visible:ring-blue-500"
                        placeholder="Search your Student ID or Name..."
                        value={query} onChange={e => setQuery(e.target.value)}
                    />
                    {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-blue-600 w-5 h-5" />}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Sections */}
                    <div className="lg:col-span-8 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-600" /> Live Section Status
                                <span className="text-sm font-normal text-slate-400 hidden sm:inline">(click to view students)</span>
                            </h2>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 w-fit px-3 py-1">
                                <span className="font-bold mr-1">{sections.reduce((sum, sec) => sum + sec.current, 0)}</span> Students Enlisted
                            </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {sections.map(sec => {
                                const pct = Math.round((sec.current / sec.capacity) * 100);
                                const bar = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-blue-500";
                                const isFull = sec.current >= sec.capacity;
                                return (
                                    <Link key={sec.id} href={`/sections/${sec.id}`}>
                                        <Card className="border-none shadow-sm hover:shadow-lg transition-all bg-white cursor-pointer hover:-translate-y-0.5">
                                            <CardContent className="p-5">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-900">Section {sec.name}</h3>
                                                        <p className="text-xs text-slate-400">{(sec.semesters as any)?.name}</p>
                                                    </div>
                                                    <Badge variant={isFull ? "destructive" : "secondary"} className="rounded-full px-3">
                                                        {sec.current}/{sec.capacity}
                                                    </Badge>
                                                </div>
                                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                    <div className={`h-full transition-all duration-500 ${bar}`} style={{ width: `${pct}%` }} />
                                                </div>
                                                <p className="text-xs text-slate-500 mt-2">{isFull ? "Section Full" : `${sec.capacity - sec.current} seats remaining`}</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Advisor List */}
                        <h2 id="advisors" className="text-xl font-bold text-slate-800 flex items-center gap-2 pt-4">
                            <GraduationCap className="w-5 h-5 text-blue-600" /> Advisors
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {advisors.map(a => (
                                <Card key={a.id} className="border-none shadow-sm bg-white">
                                    <CardContent className="p-4">
                                        <p className="font-semibold text-slate-800">{a.name}</p>
                                        <p className="text-xs text-slate-500">{a.designation || 'Advisor'}</p>
                                        <p className="text-xs text-blue-600 mt-1">📧 {a.email}</p>
                                        {a.phone && <p className="text-xs text-slate-500 mt-0.5">📞 {a.phone}</p>}
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {(a.student_advisor_ranges || []).map((r: any, i: number) => (
                                                <Badge key={i} variant="outline" className="text-[10px]">{r.start_id} – {r.end_id}</Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Search Results */}
                    <div className="lg:col-span-4 space-y-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-blue-600" /> Your Info
                        </h2>
                        {query.length >= 3 ? (
                            <div className="space-y-4">
                                {results.length > 0 ? results.map(reg => (
                                    <Card key={reg.id} className={`bg-white shadow-lg border-l-4 ${reg.advisor_completed ? 'border-l-green-500' : 'border-l-blue-600'}`}>
                                        <CardContent className="p-5 space-y-3">
                                            {reg.advisor_completed && (
                                                <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                                    <CheckCircle2 className="w-4 h-4" /> Advisor Pre-Registration Completed
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</p>
                                                <p className="text-lg font-bold text-slate-900">{reg.student_name}</p>
                                                <p className="text-sm font-mono text-slate-500">{reg.student_id}</p>
                                            </div>
                                            <div className="border-t pt-3 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4 text-blue-500" />
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Section</p>
                                                        <p className="text-sm font-bold">
                                                            <Link href={`/sections/${reg.sections?.id}`} className="text-blue-600 hover:underline">
                                                                Section {reg.sections?.name}
                                                            </Link>
                                                        </p>
                                                    </div>
                                                </div>
                                                {reg.lab_groups?.name && (
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-4 h-4 text-blue-500" />
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Lab Group</p>
                                                            <p className="text-sm font-bold">{reg.lab_groups.name}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <GraduationCap className="w-4 h-4 text-blue-500" />
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Advisor</p>
                                                        <p className="text-sm font-bold">{reg.advisors?.name || "Not assigned yet"}</p>
                                                        {reg.advisors?.phone && <p className="text-xs text-slate-400">📞 {reg.advisors.phone}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                            {reg.advisor_note && (
                                                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-sm">
                                                    <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Note from Advisor</p>
                                                    <p className="text-sm text-slate-700 font-medium">"{reg.advisor_note}"</p>
                                                </div>
                                            )}
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
                                <p className="text-blue-600/60 text-sm italic">Enter your ID or name to check section, lab group &amp; advisor.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
