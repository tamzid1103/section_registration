"use client";

import { useState, useEffect, useRef } from "react";
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
import { Search, Loader2, BookOpen, GraduationCap, Users, CheckCircle2, LogIn, LayoutDashboard, ArrowUp, InfoIcon, KeyRound, User, Shield, Clock3, Timer, Eye, EyeOff, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";

type Mode = "login" | "register";
type RegisterRole = "cr" | "advisor" | "student";

type RegistrationTimerState = {
    enabled: boolean;
    startAt: string | null;
    endAt: string | null;
    timezone: string;
};

export default function StudentHub() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [advisors, setAdvisors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const searchCacheRef = useRef<Map<string, any[]>>(new Map());
    const advisorRangesRef = useRef<any[] | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [dashboardUrl, setDashboardUrl] = useState("/auth/login");
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [currentTime, setCurrentTime] = useState(() => new Date());
    const [registrationTimer, setRegistrationTimer] = useState<RegistrationTimerState>({
        enabled: false,
        startAt: null,
        endAt: null,
        timezone: "Asia/Dhaka",
    });

    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<Mode>("login");
    const [registerRole, setRegisterRole] = useState<RegisterRole>("student");
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [authConfirmPassword, setAuthConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [authFullName, setAuthFullName] = useState("");
    const [authStudentId, setAuthStudentId] = useState("");
    const [authSectionInterested, setAuthSectionInterested] = useState("");
    const [mounted, setMounted] = useState(false);

    async function fetchData() {
        const response = await fetch('/api/cache/home', { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json()
        const homeData = payload.data || {}
        setSections(homeData.sections || [])
        setAdvisors(homeData.advisors || [])
        setRegistrationTimer({
            enabled: Boolean(homeData.registrationTimer?.enabled),
            startAt: homeData.registrationTimer?.startAt || null,
            endAt: homeData.registrationTimer?.endAt || null,
            timezone: homeData.registrationTimer?.timezone || "Asia/Dhaka",
        })
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
                        const map: Record<string, string> = {
                            developer: '/developer',
                            admin: '/admin',
                            advisor: '/advisor',
                            cr: '/cr/manage',
                            student: '/student/dashboard'
                        };
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
            if (data?.role === "student") { router.push("/student/dashboard"); return; }

            const { data: studentRec } = await supabase
                .from("allowed_students")
                .select("student_id, name")
                .eq("email", userEmail)
                .maybeSingle();

            if (studentRec) {
                await supabase.from("authorized_staff").insert({
                    email: userEmail,
                    role: "student",
                    name: studentRec.name,
                });
                router.push("/student/dashboard");
                return;
            }

            // Open-domain: any edu-domain email can be a student even if not pre-listed
            const emailDomain = userEmail.split('@')[1] || ''
            if (emailDomain === 'diu.edu.bd' || emailDomain === 'daffodilvarsity.edu.bd') {
                router.push("/student/dashboard");
                return;
            }

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

        const inputVal = authEmail.trim();
        let loginEmail = inputVal.toLowerCase();

        if (!loginEmail.includes("@")) {
            // Try allowed_students first
            const { data: allowedRec } = await supabase
                .from("allowed_students")
                .select("email")
                .eq("student_id", inputVal)
                .maybeSingle();

            if (allowedRec?.email) {
                loginEmail = allowedRec.email;
            } else {
                // Also try authorized_staff (open-domain students registered without pre-auth)
                const { data: staffRec } = await supabase
                    .from("authorized_staff")
                    .select("email")
                    .eq("name", inputVal)
                    .eq("role", "student")
                    .maybeSingle();

                if (staffRec?.email) {
                    loginEmail = staffRec.email;
                } else {
                    setAuthError("No student found with this Student ID. Please log in using your email directly.");
                    setAuthLoading(false);
                    return;
                }
            }
        }

        if (!loginEmail || !authPassword) {
            setAuthError("Email/Student ID and password are required.");
            setAuthLoading(false);
            return;
        }

        if (!isAllowedDomain(loginEmail) && !isDeveloper(loginEmail)) {
            setAuthError("Only DIU university emails are allowed to login.");
            setAuthLoading(false);
            return;
        }

        try {
            const { error: authErr } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: authPassword,
            });

            if (authErr) {
                setAuthError(authErr.message);
                return;
            }

            await redirectByRole(loginEmail);
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
        if (!trimmedEmail || !authPassword || !authFullName || !authConfirmPassword) {
            setAuthError("Full name, email, password, and confirm password are required.");
            setAuthLoading(false);
            return;
        }
        if (authPassword !== authConfirmPassword) {
            setAuthError("Passwords do not match.");
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
        if (registerRole === "student" && !authStudentId) {
            setAuthError("Student ID is required for student registration.");
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

            if (registerRole === "student") {
                toast.success(json.message || "Account created successfully! Logging you in...");
                const { error: signInErr } = await supabase.auth.signInWithPassword({
                    email: trimmedEmail,
                    password: authPassword,
                });
                if (signInErr) {
                    toast.success("Account created successfully! Please login now.");
                    setAuthOpen(false);
                    return;
                }
                router.push("/student/dashboard");
            } else if (registerRole === "advisor") {
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
        setAuthPassword("");
        setAuthConfirmPassword("");
        setShowPassword(false);
        setShowConfirmPassword(false);
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
        const trimmed = query.trim();
        if (trimmed.length < 2) { 
            setResults([]); 
            setLoading(false);
            return; 
        }

        const cacheKey = trimmed.toLowerCase();
        if (searchCacheRef.current.has(cacheKey)) {
            setResults(searchCacheRef.current.get(cacheKey) || []);
            setLoading(false);
            return;
        }

        setLoading(true);

        const search = async () => {
            try {
                // Ensure ranges are cached once
                if (!advisorRangesRef.current) {
                    const { data: ranges } = await supabase
                        .from("student_advisor_ranges")
                        .select("advisor_id, start_id_numeric, end_id_numeric");
                    advisorRangesRef.current = ranges || [];
                }
                const rangesData = advisorRangesRef.current || [];

                // Fast parallel queries for active registrations and student roster
                const [regRes, allowedRes] = await Promise.all([
                    supabase
                        .from("registrations")
                        .select("*, sections!inner(name, id, semesters!inner(is_active)), lab_groups(name), advisors(name, phone, designation)")
                        .eq("sections.semesters.is_active", true)
                        .or(`student_id.ilike.%${trimmed}%,student_name.ilike.%${trimmed}%`)
                        .limit(10),
                    supabase
                        .from("allowed_students")
                        .select("*")
                        .or(`student_id.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
                        .limit(10),
                ]);

                const regData = regRes.data || [];
                const allowedData = allowedRes.data || [];

                const resolveAdvisorForStudent = (stdId: string) => {
                    if (!stdId || rangesData.length === 0 || advisors.length === 0) return null;
                    const numId = parseInt(stdId.replace(/-/g, ''), 10);
                    if (isNaN(numId)) return null;
                    const rangeMatch = rangesData.find(r => numId >= Number(r.start_id_numeric) && numId <= Number(r.end_id_numeric));
                    if (!rangeMatch) return null;
                    return advisors.find(a => a.id === rangeMatch.advisor_id) || null;
                };

                const combinedResults: any[] = [];
                const processedStudentIds = new Set<string>();

                if (allowedData.length > 0) {
                    for (const student of allowedData) {
                        const normId = student.student_id.trim().toLowerCase();
                        processedStudentIds.add(normId);

                        const matchReg = regData.find(
                            r => r.student_id.trim().toLowerCase() === normId
                        );

                        if (matchReg) {
                            combinedResults.push(matchReg);
                        } else {
                            combinedResults.push({
                                id: `unreg-${student.id}`,
                                student_id: student.student_id,
                                student_name: student.name,
                                email: student.email,
                                sections: null,
                                lab_groups: null,
                                advisors: null,
                                advisor_completed: false,
                                isUnregistered: true
                            });
                        }
                    }
                }

                if (regData.length > 0) {
                    for (const reg of regData) {
                        const normId = reg.student_id.trim().toLowerCase();
                        if (!processedStudentIds.has(normId)) {
                            processedStudentIds.add(normId);
                            combinedResults.push(reg);
                        }
                    }
                }

                const finalResults = combinedResults.map(item => ({
                    ...item,
                    advisors: item.advisors || resolveAdvisorForStudent(item.student_id)
                }));

                // Keep cache bounded to prevent memory build-up
                if (searchCacheRef.current.size > 40) {
                    const firstKey = searchCacheRef.current.keys().next().value;
                    if (firstKey) searchCacheRef.current.delete(firstKey);
                }
                searchCacheRef.current.set(cacheKey, finalResults);

                setResults(finalResults);
            } finally {
                setLoading(false);
            }
        };

        const t = setTimeout(search, 140);
        return () => clearTimeout(t);
    }, [query, advisors]);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 320);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        setMounted(true);
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

    const formatDhakaClock = (date: Date) => new Intl.DateTimeFormat("en-GB", {
        timeZone: registrationTimer.timezone || "Asia/Dhaka",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);

    const formatDhakaDate = (date: Date) => new Intl.DateTimeFormat("en-GB", {
        timeZone: registrationTimer.timezone || "Asia/Dhaka",
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);

    const formatCountdown = (targetMs: number) => {
        const remaining = Math.max(0, targetMs - currentTime.getTime());
        const totalSeconds = Math.floor(remaining / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${days}d : ${String(hours).padStart(2, "0")}h : ${String(minutes).padStart(2, "0")}m : ${String(seconds).padStart(2, "0")}s`;
    };

    const getTimerDisplayState = () => {
        const startMs = registrationTimer.startAt ? new Date(registrationTimer.startAt).getTime() : null;
        const endMs = registrationTimer.endAt ? new Date(registrationTimer.endAt).getTime() : null;
        const nowMs = currentTime.getTime();

        if (!registrationTimer.enabled || !startMs || !endMs) {
            return {
                title: "Current Time",
                value: formatDhakaClock(currentTime),
                subtitle: formatDhakaDate(currentTime),
                chip: "Idle",
            };
        }

        if (nowMs < startMs) {
            return {
                title: "Registration Starts In",
                value: formatCountdown(startMs),
                subtitle: `Starts ${new Date(startMs).toLocaleString()}`,
                chip: "Before Start",
            };
        }

        if (nowMs < endMs) {
            return {
                title: "Registration Ends In",
                value: formatCountdown(endMs),
                subtitle: `Ends ${new Date(endMs).toLocaleString()}`,
                chip: "Active",
            };
        }

        return {
            title: "Registration Window Ended",
            value: formatDhakaClock(currentTime),
            subtitle: formatDhakaDate(currentTime),
            chip: "Ended",
        };
    };

    const timerDisplay = getTimerDisplayState();

    const hasQuery = query.length >= 2;

    const renderResults = () => {
        if (!hasQuery) {
            return (
                <div className="p-5 rounded-xl border border-dashed border-border bg-muted/20 text-center">
                    <p className="text-muted-foreground text-xs">Enter your Student ID or full name to view section, lab &amp; advisor details.</p>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {results.length > 0 ? results.map(reg => (
                    <div
                        key={reg.id}
                        className={`p-4 rounded-xl border bg-card shadow-2xs space-y-3 transition-all ${
                            reg.isUnregistered
                                ? "border-amber-300 dark:border-amber-800"
                                : reg.advisor_completed
                                    ? "border-emerald-300 dark:border-emerald-800"
                                    : "border-border"
                        }`}
                    >
                        {reg.advisor_completed && (
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Advisor Pre-Registration Verified
                            </div>
                        )}
                        {reg.isUnregistered && (
                            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Section choice pending
                            </div>
                        )}

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Student</p>
                            <p className="text-sm font-bold text-foreground">{reg.student_name}</p>
                            <p className="text-xs font-mono text-muted-foreground">{reg.student_id}</p>
                        </div>

                        <div className="border-t border-border/60 pt-2.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5 text-primary" /> Section:
                                </span>
                                {reg.sections?.id ? (
                                    <Link href={`/sections/${reg.sections?.id}`} className="font-semibold text-primary hover:underline">
                                        Section {reg.sections?.name}
                                    </Link>
                                ) : (
                                    <span className="text-amber-600 font-medium">Not Selected</span>
                                )}
                            </div>

                            {reg.lab_groups?.name && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-primary" /> Lab:
                                    </span>
                                    <span className="font-semibold text-foreground">Lab {reg.lab_groups.name}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <GraduationCap className="w-3.5 h-3.5 text-primary" /> Advisor:
                                </span>
                                <span className="font-semibold text-foreground">{reg.advisors?.name || "Not assigned"}</span>
                            </div>
                        </div>

                        {reg.advisor_note && (
                            <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs">
                                <p className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">Note from Advisor</p>
                                <p className="text-foreground italic mt-0.5">"{reg.advisor_note}"</p>
                            </div>
                        )}
                    </div>
                )) : (
                    <div className="p-6 rounded-xl border border-dashed border-border bg-muted/20 text-center">
                        <p className="text-muted-foreground text-xs">No records found matching &quot;{query}&quot;</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
            {/* Academic Navigation & Hero Header */}
            <div className="border-b-2 border-border bg-card/95 backdrop-blur shadow-xs relative">
                {/* University Branded Color Ribbon */}
                <div className="h-1.5 w-full bg-gradient-to-r from-[#0F766E] via-[#059669] to-[#D97706] diu:from-[#0B3B60] diu:via-[#008751] diu:to-[#D97706]" />

                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
                    {/* Top Row: Brand, Clock, & Global Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-sm tracking-wider shadow-xs ring-2 ring-primary/25 shrink-0">
                                DIU
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Section Pre-Registration</h1>
                                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/25">
                                        Academic Portal
                                    </span>
                                </div>
                                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                    <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" /> Department of Computer Science &amp; Engineering · Daffodil International University
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Live Timer Pill */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-border bg-muted/40 text-xs text-muted-foreground shadow-2xs">
                                <Clock3 className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="font-mono font-bold text-foreground">{mounted ? timerDisplay.value : '—:—:—'}</span>
                                <span className="text-[10px] uppercase font-black tracking-wider px-1.5 py-0.2 rounded bg-background border border-border text-foreground">{timerDisplay.chip}</span>
                            </div>

                            <ThemeToggle variant="pills" />

                            {userRole ? (
                                <Link
                                    href={dashboardUrl}
                                    className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl px-4 py-2 hover:bg-primary/90 transition-all shadow-xs"
                                >
                                    <LayoutDashboard className="w-3.5 h-3.5" /> Portal Dashboard
                                </Link>
                            ) : (
                                <Dialog open={authOpen} onOpenChange={setAuthOpen}>
                                    <DialogTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => setAuthMode("login")}
                                            className="inline-flex items-center gap-1.5 text-foreground hover:text-primary text-xs font-bold border-2 border-border bg-card hover:bg-muted rounded-xl px-4 py-2 transition-all shadow-xs"
                                        >
                                            <LogIn className="w-3.5 h-3.5" /> Portal Login
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-md rounded-2xl p-6 border-border shadow-md">
                                        <DialogHeader>
                                            <div className="mx-auto mb-2 w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                                                <GraduationCap className="w-5 h-5" />
                                            </div>
                                            <DialogTitle className="text-center text-xl font-bold tracking-tight text-foreground">
                                                {authMode === "login" ? "Portal Access" : "Create Account"}
                                            </DialogTitle>
                                            <DialogDescription className="text-center text-xs text-muted-foreground">
                                                {authMode === "login"
                                                    ? "Enter your DIU student ID or email to access your dashboard"
                                                    : "Register as Student, CR or Faculty Advisor"}
                                            </DialogDescription>
                                        </DialogHeader>

                                        <form className="space-y-3.5 pt-2" onSubmit={handleAuthSubmit}>
                                            <div className="p-3 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground flex items-start gap-2">
                                                <InfoIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                <p>
                                                    {authMode === "login"
                                                        ? "Use your official @diu.edu.bd email or Student ID to login."
                                                        : "Students must be pre-authorized in the semester roster."}
                                                </p>
                                            </div>

                                            {authMode === "register" && (
                                                <div className="grid grid-cols-3 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRegisterRole("cr")}
                                                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all ${
                                                            registerRole === "cr"
                                                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                                                : "border-border text-muted-foreground hover:text-foreground"
                                                        }`}
                                                    >
                                                        <Shield className="w-4 h-4" /> CR
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRegisterRole("student")}
                                                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all ${
                                                            registerRole === "student"
                                                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                                                : "border-border text-muted-foreground hover:text-foreground"
                                                        }`}
                                                    >
                                                        <GraduationCap className="w-4 h-4" /> Student
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRegisterRole("advisor")}
                                                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all ${
                                                            registerRole === "advisor"
                                                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                                                : "border-border text-muted-foreground hover:text-foreground"
                                                        }`}
                                                    >
                                                        <User className="w-4 h-4" /> Advisor
                                                    </button>
                                                </div>
                                            )}

                                            {authMode === "register" && (
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-foreground">Full Name</label>
                                                    <Input
                                                        placeholder="Your full name"
                                                        value={authFullName}
                                                        onChange={(e) => setAuthFullName(e.target.value)}
                                                        className="h-9 text-xs"
                                                    />
                                                </div>
                                            )}

                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-foreground">
                                                    {authMode === "register" ? "University Email" : "Email or Student ID"}
                                                </label>
                                                <Input
                                                    type="text"
                                                    placeholder={authMode === "register" ? "name@diu.edu.bd" : "Enter ID or email"}
                                                    value={authEmail}
                                                    onChange={(e) => setAuthEmail(e.target.value)}
                                                    className="h-9 text-xs"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-foreground">Password</label>
                                                <div className="relative">
                                                    <Input
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Enter your password"
                                                        value={authPassword}
                                                        onChange={(e) => setAuthPassword(e.target.value)}
                                                        className="h-9 text-xs pr-9"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                    >
                                                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {authMode === "register" && (
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-foreground">Confirm Password</label>
                                                    <div className="relative">
                                                        <Input
                                                            type={showConfirmPassword ? "text" : "password"}
                                                            placeholder="Re-enter password"
                                                            value={authConfirmPassword}
                                                            onChange={(e) => setAuthConfirmPassword(e.target.value)}
                                                            className="h-9 text-xs pr-9"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                        >
                                                            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {authError && (
                                                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                                                    {authError}
                                                </div>
                                            )}

                                            <Button className="w-full h-10 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 mt-2" type="submit" disabled={authLoading}>
                                                {authLoading
                                                    ? "Processing..."
                                                    : authMode === "login"
                                                        ? <><KeyRound className="w-3.5 h-3.5 mr-1.5" /> Sign In</>
                                                        : <><User className="w-3.5 h-3.5 mr-1.5" /> Create Account</>
                                                }
                                            </Button>

                                            <button
                                                type="button"
                                                className="w-full text-center text-xs text-muted-foreground hover:text-foreground pt-1"
                                                onClick={toggleAuthMode}
                                            >
                                                {authMode === "login"
                                                    ? "Don't have an account? Register here"
                                                    : "Already have an account? Sign in"}
                                            </button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>

                    {/* Masthead Banner info */}
                    <div className="pt-4 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md font-extrabold text-[11px] bg-primary/10 text-primary border border-primary/25">
                                Live Pre-Registration
                            </span>
                            <span className="hidden sm:inline text-muted-foreground/60">·</span>
                            <span className="text-xs font-semibold text-foreground">
                                Real-time cohort capacity, lab choices &amp; assigned faculty advising.
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground shrink-0">
                            <span className="flex items-center gap-1.5 text-foreground">
                                <Users className="w-3.5 h-3.5 text-primary" /> Active Cohorts: <span className="text-primary font-black">{sections.length}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
                {/* Search Bar - High contrast Spotlight Input */}
                <div className="relative max-w-2xl mx-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        className="h-12 pl-11 pr-10 text-sm bg-card shadow-xs border-2 border-border rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all font-medium text-foreground"
                        placeholder="Search by Student ID (e.g. 211-15-1234) or Name..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary w-4 h-4" />}
                </div>

                {/* Mobile Results */}
                <div className="lg:hidden space-y-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" /> Search Results
                    </h2>
                    {renderResults()}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Live Section Status (8 cols on desktop) */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                                        <Users className="w-4 h-4 text-primary" /> Live Section Status
                                    </h2>
                                    <p className="text-xs text-muted-foreground font-medium">Real-time seat occupancy across all active semester sections.</p>
                                </div>
                                <Badge variant="outline" className="bg-card text-foreground border-2 border-border text-xs px-3 py-1 font-bold shadow-2xs">
                                    <span className="font-black text-primary mr-1">{sections.reduce((sum, sec) => sum + sec.current, 0)}</span> Enlisted
                                </Badge>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                                {sections.map(sec => {
                                    const pct = Math.min(100, Math.round((sec.current / sec.capacity) * 100));
                                    const isFull = sec.current >= sec.capacity;
                                    const isAlmostFull = pct >= 80 && !isFull;

                                    return (
                                        <Link key={sec.id} href={`/sections/${sec.id}`} className="group block">
                                            <div className="p-5 rounded-2xl border-2 border-border bg-card hover:border-primary/60 hover:shadow-md transition-all duration-150 space-y-4">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h3 className="font-extrabold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors tracking-tight">
                                                            Section {sec.name}
                                                        </h3>
                                                        <p className="text-xs font-bold text-muted-foreground mt-0.5">
                                                            {(sec.semesters as any)?.name || 'Active Semester'}
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border shadow-2xs shrink-0 ${
                                                            isFull
                                                                ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700'
                                                                : isAlmostFull
                                                                    ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700'
                                                                    : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700'
                                                        }`}
                                                    >
                                                        {isFull ? 'FULL' : isAlmostFull ? 'Almost Full' : 'Available'}
                                                    </Badge>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden p-0.5 border border-border/50">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-300 ${
                                                                isFull ? 'bg-rose-500' : isAlmostFull ? 'bg-amber-500' : 'bg-primary'
                                                            }`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs font-medium pt-0.5">
                                                        <span className="text-foreground">
                                                            <strong className="text-sm font-black text-foreground">{sec.current}</strong>
                                                            <span className="text-muted-foreground font-semibold">/{sec.capacity} seats filled</span>
                                                        </span>
                                                        <span className={`font-bold px-2.5 py-0.5 rounded-md text-xs border ${
                                                            isFull
                                                                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                                                : isAlmostFull
                                                                    ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                                                    : 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                        }`}>
                                                            {sec.capacity - sec.current} {sec.capacity - sec.current === 1 ? 'seat' : 'seats'} left
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Faculty Advisors Directory */}
                        <div id="advisors" className="space-y-3 pt-4 border-t border-border/70">
                            <div>
                                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-primary" /> Faculty Advisors
                                </h2>
                                <p className="text-xs text-muted-foreground">Assigned academic advisors per student ID ranges.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {sortedAdvisors.map(a => (
                                    <div key={a.id} className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-2">
                                        <div>
                                            <p className="font-semibold text-xs text-foreground">{a.name}</p>
                                            <p className="text-[11px] text-muted-foreground">{a.designation || 'Faculty Member'} {a.cabin ? `· Cabin ${a.cabin}` : ''}</p>
                                            <p className="text-[11px] text-primary mt-0.5">{a.email}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/60">
                                            {(a.student_advisor_ranges || [])
                                                .slice()
                                                .sort((r1: any, r2: any) => parseStudentIdToNumber(r1.start_id) - parseStudentIdToNumber(r2.start_id))
                                                .map((r: any, i: number) => (
                                                    <Badge key={i} variant="outline" className="text-[9px] font-mono bg-muted/40 border-border text-muted-foreground">
                                                        {r.start_id} – {r.end_id}
                                                    </Badge>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Search Results (4 cols on desktop) */}
                    <div className="hidden lg:block lg:col-span-4 space-y-3">
                        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-primary" /> Search Results
                        </h2>
                        {renderResults()}
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={`fixed bottom-6 right-6 z-50 rounded-full bg-primary text-primary-foreground shadow-md p-2.5 transition-all duration-150 ${
                    showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                }`}
                aria-label="Scroll to top"
            >
                <ArrowUp className="w-4 h-4" />
            </button>
        </div>
    );
}
