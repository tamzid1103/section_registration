"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, BookOpen, GraduationCap, Users, CheckCircle2, LogIn, LayoutDashboard, ArrowUp } from "lucide-react";
import Link from "next/link";

export default function StudentHub() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [advisors, setAdvisors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [dashboardUrl, setDashboardUrl] = useState("/auth/login");
    const [showScrollTop, setShowScrollTop] = useState(false);

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
            if (query.length < 2) { setResults([]); return; }
            setLoading(true);
            const { data } = await supabase
                .from("registrations")
                .select("*, sections(name, id), lab_groups(name), advisors(name, phone, designation)")
                .or(`student_id.ilike.%${query}%,student_name.ilike.%${query}%`)
                .limit(10);
            if (data) setResults(data);
            setLoading(false);
        };
        const t = setTimeout(search, 250);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 320);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const parseStudentIdToNumber = (value: string) => {
        const parts = (value || "").split("-");
        if (parts.length !== 3) return Number.POSITIVE_INFINITY;
        const [batch, dept, roll] = parts.map(part => Number(part));
        if ([batch, dept, roll].some(n => Number.isNaN(n))) return Number.POSITIVE_INFINITY;
        return batch * 1000000 + dept * 1000 + roll;
    };

    const getAdvisorSortKey = (advisor: any) => {
        const ranges = advisor?.student_advisor_ranges || [];
        const keys = ranges
            .map((r: any) => parseStudentIdToNumber(r.start_id))
            .filter((n: number) => Number.isFinite(n));
        return keys.length ? Math.min(...keys) : Number.POSITIVE_INFINITY;
    };

    const sortedAdvisors = [...advisors].sort((a, b) => {
        const diff = getAdvisorSortKey(a) - getAdvisorSortKey(b);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
    });

    const hasQuery = query.length >= 2;

    const renderResults = () => {
        if (!hasQuery) {
            return (
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-center">
                    <p className="text-blue-600/60 text-sm italic">Enter your ID or name to check section, lab group &amp; advisor.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {results.length > 0 ? results.map(reg => (
                    <Card key={reg.id} className={`bg-white shadow-lg border-l-4 ${reg.advisor_completed ? "border-l-green-500" : "border-l-blue-600"}`}>
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
        );
    };

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

                {/* Mobile Results */}
                <div className="lg:hidden space-y-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-600" /> Your Info
                    </h2>
                    {renderResults()}
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
                                const isFull = sec.current >= sec.capacity;
                                const bar = pct >= 90 ? "from-rose-500 to-rose-600" : pct >= 70 ? "from-amber-400 to-amber-500" : "from-blue-500 to-blue-600";
                                const seatTone = isFull
                                    ? "text-rose-700 bg-rose-50 border-rose-200"
                                    : pct >= 70
                                        ? "text-amber-700 bg-amber-50 border-amber-200"
                                        : "text-blue-700 bg-blue-50 border-blue-200";
                                return (
                                    <Link key={sec.id} href={`/sections/${sec.id}`}>
                                        <Card className="border border-slate-100 shadow-sm hover:shadow-lg transition-all bg-gradient-to-br from-white via-slate-50 to-emerald-50/60 cursor-pointer hover:-translate-y-0.5">
                                            <CardContent className="p-5">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-900">Section {sec.name}</h3>
                                                        <p className="text-xs text-slate-400">{(sec.semesters as any)?.name}</p>
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
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Advisor List */}
                        <h2 id="advisors" className="text-xl font-bold text-slate-800 flex items-center gap-2 pt-4">
                            <GraduationCap className="w-5 h-5 text-blue-600" /> Advisors
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {sortedAdvisors.map(a => (
                                <Card key={a.id} className="border-none shadow-sm bg-white">
                                    <CardContent className="p-4">
                                        <p className="font-semibold text-slate-800">{a.name}</p>
                                        <p className="text-xs text-slate-500">{a.designation || 'Advisor'}</p>
                                        <p className="text-xs text-blue-600 mt-1">📧 {a.email}</p>
                                        {a.phone && <p className="text-xs text-slate-500 mt-0.5">📞 {a.phone}</p>}
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {(a.student_advisor_ranges || [])
                                                .slice()
                                                .sort((r1: any, r2: any) => parseStudentIdToNumber(r1.start_id) - parseStudentIdToNumber(r2.start_id))
                                                .map((r: any, i: number) => (
                                                    <Badge key={i} variant="outline" className="text-[10px]">{r.start_id} – {r.end_id}</Badge>
                                                ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Search Results */}
                    <div className="hidden lg:block lg:col-span-4 space-y-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-blue-600" /> Your Info
                        </h2>
                        {renderResults()}
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={`fixed bottom-6 right-6 z-50 rounded-full bg-blue-600 text-white shadow-lg p-3 transition-all ${showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                    }`}
                aria-label="Scroll to top"
            >
                <ArrowUp className="w-5 h-5" />
            </button>
        </div>
    );
}
