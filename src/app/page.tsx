"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allowedDomains, developerAllowlist } from "@/lib/auth-constants";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Loader2, BookOpen, GraduationCap, Users, CheckCircle2, LogIn, LayoutDashboard, ArrowUp, InfoIcon, KeyRound, User, Shield } from "lucide-react";
import Link from "next/link";

type Mode = "login" | "register";
type RegisterRole = "cr" | "advisor";

export default function StudentHub() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [advisors, setAdvisors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [dashboardUrl, setDashboardUrl] = useState("/auth/login");
    const [showScrollTop, setShowScrollTop] = useState(false);

    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<Mode>("login");
    const [registerRole, setRegisterRole] = useState<RegisterRole>("cr");
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [authFullName, setAuthFullName] = useState("");
    const [authStudentId, setAuthStudentId] = useState("");
    const [authSectionInterested, setAuthSectionInterested] = useState("");

    async function fetchData() {
        const response = await fetch('/api/cache/home', { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json()
        const homeData = payload.data || {}
        setSections(homeData.sections || [])
        setAdvisors(homeData.advisors || [])
    }

    useEffect(() => {
        fetchData();
        // Check if logged in
        supabase.auth.getUser().then((res) => {
            const user = res?.data?.user;
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

    const isDeveloper = (email: string) => developerAllowlist.includes(email.trim().toLowerCase());
    const isAllowedDomain = (email: string) => {
        const domain = email.split("@")[1]?.toLowerCase() || "";
        return allowedDomains.includes(domain);
    };

    const redirectByRole = async (userEmail: string) => {
        try {
            const { data, error: qErr } = await supabase
                .from("authorized_staff")
                .select("role")
                .eq("email", userEmail)
                .maybeSingle();

            if (qErr) throw qErr;

            if (data?.role === "developer") { router.push("/developer"); return; }
            if (data?.role === "admin") { router.push("/admin"); return; }
            if (data?.role === "advisor") { router.push("/advisor"); return; }
            if (data?.role === "cr") { router.push("/cr/manage"); return; }

            const { data: advisorRec } = await supabase
                .from("advisors")
                .select("id, name")
                .eq("email", userEmail)
                .maybeSingle();

            if (advisorRec) {
                await supabase.from("authorized_staff").insert({
                    email: userEmail,
                    role: "advisor",
                    name: advisorRec.name,
                });
                router.push("/advisor");
                return;
            }

            const { data: pending } = await supabase
                .from("cr_applications")
                .select("id")
                .eq("email", userEmail)
                .eq("status", "pending")
                .maybeSingle();

            if (pending) { router.push("/auth/pending?type=cr"); return; }
            router.push("/auth/unauthorized");
        } catch (err: any) {
            setAuthError("Login succeeded but role lookup failed: " + (err?.message || String(err)));
        }
    };

    const handleLogin = async () => {
        setAuthLoading(true);
        setAuthError(null);

        const trimmedEmail = authEmail.trim().toLowerCase();
        if (!trimmedEmail || !authPassword) {
            setAuthError("Email and password are required.");
            setAuthLoading(false);
            return;
        }

        if (!isAllowedDomain(trimmedEmail) && !isDeveloper(trimmedEmail)) {
            setAuthError("Only DIU university emails are allowed to login.");
            setAuthLoading(false);
            return;
        }

        try {
            const { error: authErr } = await supabase.auth.signInWithPassword({
                email: trimmedEmail,
                password: authPassword,
            });

            if (authErr) {
                setAuthError(authErr.message);
                return;
            }

            await redirectByRole(trimmedEmail);
            setAuthOpen(false);
        } catch (err: any) {
            setAuthError("Unexpected error: " + (err?.message || String(err)));
        } finally {
            setAuthLoading(false);
        }
    };

    const handleRegister = async () => {
        setAuthLoading(true);
        setAuthError(null);

        const trimmedEmail = authEmail.trim().toLowerCase();
        if (!trimmedEmail || !authPassword || !authFullName) {
            setAuthError("Full name, email, and password are required.");
            setAuthLoading(false);
            return;
        }
        if (isDeveloper(trimmedEmail)) {
            setAuthError("Developer accounts cannot be self-registered. Use the login form.");
            setAuthLoading(false);
            return;
        }
        if (!isAllowedDomain(trimmedEmail)) {
            setAuthError("Only DIU university emails (@diu.edu.bd or @daffodilvarsity.edu.bd) can register.");
            setAuthLoading(false);
            return;
        }
        if (registerRole === "cr" && (!authStudentId || !authSectionInterested)) {
            setAuthError("Student ID and section are required for CR registration.");
            setAuthLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: registerRole,
                    email: trimmedEmail,
                    password: authPassword,
                    fullName: authFullName,
                    studentId: authStudentId,
                    sectionInterested: authSectionInterested,
                }),
            });

            const json = await res.json();

            if (!res.ok || json.error) {
                setAuthError(json.error || "Registration failed. Please try again.");
                return;
            }

            if (registerRole === "advisor") {
                const { error: signInErr } = await supabase.auth.signInWithPassword({
                    email: trimmedEmail,
                    password: authPassword,
                });
                if (signInErr) {
                    setAuthError("Account created! Please login now.");
                    return;
                }
                router.push("/advisor");
            } else {
                router.push(json.redirect || "/auth/pending?type=cr");
            }

            setAuthOpen(false);
        } catch (err: any) {
            setAuthError("Network error: " + (err?.message || String(err)));
        } finally {
            setAuthLoading(false);
        }
    };

    const toggleAuthMode = () => {
        setAuthMode(authMode === "login" ? "register" : "login");
        setAuthError(null);
    };

    const handleAuthSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (authMode === "login") {
            await handleLogin();
            return;
        }
        await handleRegister();
    };

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
        return (a?.name ?? "").localeCompare(b?.name ?? "");
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
                        <Dialog open={authOpen} onOpenChange={setAuthOpen}>
                            <DialogTrigger asChild>
                                <button
                                    type="button"
                                    onClick={() => setAuthMode("login")}
                                    className="flex items-center gap-1.5 text-blue-100 hover:text-white text-sm border border-blue-300 hover:border-white rounded-lg px-3 py-1.5 transition-colors"
                                >
                                    <LogIn className="w-4 h-4" /> Staff Login
                                </button>
                            </DialogTrigger>
                            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-5 sm:p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-top-8 data-[state=closed]:slide-out-to-top-6">
                                <DialogHeader>
                                    <div className="mx-auto mb-3 w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                                        <GraduationCap className="w-7 h-7 text-white" />
                                    </div>
                                    <DialogTitle className="text-center text-2xl font-bold tracking-tight">
                                        {authMode === "login" ? "Portal Login" : "Create Account"}
                                    </DialogTitle>
                                    <DialogDescription className="text-center">
                                        {authMode === "login"
                                            ? "Login with your university email"
                                            : "Register as a CR or Advisor using your DIU email"}
                                    </DialogDescription>
                                </DialogHeader>

                                <form className="space-y-4" onSubmit={handleAuthSubmit}>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 text-blue-800 text-sm">
                                        <InfoIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <p>Students do not need an account — use the search on the home page.</p>
                                    </div>

                                    {authMode === "register" && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setRegisterRole("cr")}
                                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${registerRole === "cr"
                                                    ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                                                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                                    }`}
                                            >
                                                <Shield className="w-5 h-5" />
                                                Apply as CR
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRegisterRole("advisor")}
                                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${registerRole === "advisor"
                                                    ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                                                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                                    }`}
                                            >
                                                <User className="w-5 h-5" />
                                                Register as Advisor
                                            </button>
                                        </div>
                                    )}

                                    {authMode === "register" && (
                                        <div className={`text-xs rounded-lg p-3 border ${registerRole === "cr"
                                            ? "bg-amber-50 border-amber-200 text-amber-800"
                                            : "bg-green-50 border-green-200 text-green-800"
                                            }`}>
                                            {registerRole === "cr"
                                                ? "CR applications require admin approval before access is granted."
                                                : "Advisor accounts are auto-approved if your email is registered in the system."}
                                        </div>
                                    )}

                                    {authMode === "register" && (
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium">Full Name</label>
                                            <Input
                                                placeholder="Your full name"
                                                value={authFullName}
                                                onChange={(e) => setAuthFullName(e.target.value)}
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">Email</label>
                                        <Input
                                            type="email"
                                            placeholder={authMode === "register" ? "name@diu.edu.bd" : "Enter your email"}
                                            value={authEmail}
                                            onChange={(e) => setAuthEmail(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">Password</label>
                                        <Input
                                            type="password"
                                            placeholder="Enter your password"
                                            value={authPassword}
                                            onChange={(e) => setAuthPassword(e.target.value)}
                                        />
                                    </div>

                                    {authMode === "register" && registerRole === "cr" && (
                                        <>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Your Student ID</label>
                                                <Input
                                                    placeholder="241-15-877"
                                                    value={authStudentId}
                                                    onChange={(e) => setAuthStudentId(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Section You Want to Manage</label>
                                                <Input
                                                    placeholder="e.g. 66_A"
                                                    value={authSectionInterested}
                                                    onChange={(e) => setAuthSectionInterested(e.target.value)}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {authError && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <p className="text-sm text-red-700 font-medium">{authError}</p>
                                        </div>
                                    )}

                                    <Button className="w-full h-11 gap-2 text-base" type="submit" disabled={authLoading}>
                                        {authLoading
                                            ? "Processing..."
                                            : authMode === "login"
                                                ? <><KeyRound className="w-4 h-4" /> Login</>
                                                : <><User className="w-4 h-4" /> Create Account</>
                                        }
                                    </Button>

                                    {authMode === "login" && (
                                        <Link
                                            href="/auth/forgot-password"
                                            className="block text-center text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
                                        >
                                            Forgot your password?
                                        </Link>
                                    )}

                                    <button
                                        type="button"
                                        className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-100"
                                        onClick={toggleAuthMode}
                                    >
                                        {authMode === "login"
                                            ? "Don't have an account? Register here"
                                            : "Already have an account? Login"}
                                    </button>
                                </form>
                            </DialogContent>
                        </Dialog>
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
