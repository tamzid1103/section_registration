"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allowedDomains, developerAllowlist } from "@/lib/auth-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { InfoIcon, KeyRound, User, GraduationCap, Shield } from "lucide-react";
import Link from "next/link";

type Mode = "login" | "register";
type RegisterRole = "cr" | "advisor";

export default function LoginPage() {
    const [mode, setMode] = useState<Mode>("login");
    const [registerRole, setRegisterRole] = useState<RegisterRole>("cr");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // shared fields
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");

    // CR-only fields
    const [studentId, setStudentId] = useState("");
    const [sectionInterested, setSectionInterested] = useState("");

    const router = useRouter();

    const isDeveloper = (e: string) => developerAllowlist.includes(e.trim().toLowerCase());
    const isAllowedDomain = (e: string) => {
        const domain = e.split("@")[1]?.toLowerCase() || "";
        return allowedDomains.includes(domain);
    };

    // After login, look up role in authorized_staff and redirect accordingly
    const redirectByRole = async (userEmail: string) => {
        try {
            const { data, error: qErr } = await supabase
                .from("authorized_staff")
                .select("role")
                .eq("email", userEmail)
                .maybeSingle();

            if (qErr) throw qErr;

            if (data?.role === "developer") { router.push("/developer"); return; }
            if (data?.role === "admin")     { router.push("/admin");     return; }
            if (data?.role === "advisor")   { router.push("/advisor");   return; }
            if (data?.role === "cr")        { router.push("/cr/manage"); return; }

            // Not in authorized_staff — check if they are in advisors table
            const { data: advisorRec } = await supabase
                .from("advisors")
                .select("id, name")
                .eq("email", userEmail)
                .maybeSingle();

            if (advisorRec) {
                // They are an advisor, auto-add to authorized_staff
                await supabase.from("authorized_staff").insert({
                    email: userEmail,
                    role: "advisor",
                    name: advisorRec.name,
                });
                router.push("/advisor");
                return;
            }

            // Check if they have a pending CR application
            const { data: pending } = await supabase
                .from("cr_applications")
                .select("id")
                .eq("email", userEmail)
                .eq("status", "pending")
                .maybeSingle();

            if (pending) { router.push("/auth/pending?type=cr"); return; }
            router.push("/auth/unauthorized");
        } catch (err: any) {
            setError("Login succeeded but role lookup failed: " + (err?.message || String(err)));
        }
    };

    // ── LOGIN ──────────────────────────────────────────────────────────────────
    const handleLogin = async () => {
        setLoading(true);
        setError(null);

        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !password) {
            setError("Email and password are required.");
            setLoading(false);
            return;
        }

        if (!isAllowedDomain(trimmedEmail) && !isDeveloper(trimmedEmail)) {
            setError("Only DIU university emails are allowed to login.");
            setLoading(false);
            return;
        }

        try {
            const { error: authErr } = await supabase.auth.signInWithPassword({
                email: trimmedEmail,
                password,
            });

            if (authErr) {
                setError(authErr.message);
                return;
            }

            await redirectByRole(trimmedEmail);
        } catch (err: any) {
            setError("Unexpected error: " + (err?.message || String(err)));
        } finally {
            setLoading(false);
        }
    };

    // ── REGISTER ───────────────────────────────────────────────────────────────
    // Registration is handled via an API route (uses service role) to bypass
    // email confirmation and RLS restrictions for unauthenticated new users.
    const handleRegister = async () => {
        setLoading(true);
        setError(null);

        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !password || !fullName) {
            setError("Full name, email, and password are required.");
            setLoading(false);
            return;
        }
        if (isDeveloper(trimmedEmail)) {
            setError("Developer accounts cannot be self-registered. Use the login form.");
            setLoading(false);
            return;
        }
        if (!isAllowedDomain(trimmedEmail)) {
            setError("Only DIU university emails (@diu.edu.bd or @daffodilvarsity.edu.bd) can register.");
            setLoading(false);
            return;
        }
        if (registerRole === "cr" && (!studentId || !sectionInterested)) {
            setError("Student ID and section are required for CR registration.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: registerRole,
                    email: trimmedEmail,
                    password,
                    fullName,
                    studentId,
                    sectionInterested,
                }),
            });

            const json = await res.json();

            if (!res.ok || json.error) {
                setError(json.error || "Registration failed. Please try again.");
                return;
            }

            if (registerRole === "advisor") {
                // Advisor is auto-approved — sign in immediately
                const { error: signInErr } = await supabase.auth.signInWithPassword({
                    email: trimmedEmail,
                    password,
                });
                if (signInErr) {
                    setError("Account created! Please login now.");
                    return;
                }
                router.push("/advisor");
            } else {
                // CR: go to pending page — admin must approve
                router.push(json.redirect || "/auth/pending?type=cr");
            }
        } catch (err: any) {
            setError("Network error: " + (err?.message || String(err)));
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(mode === "login" ? "register" : "login");
        setError(null);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 p-4">
            <Card className="w-full max-w-md shadow-2xl border-t-4 border-blue-600">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-3 w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                        <GraduationCap className="w-7 h-7 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">
                        {mode === "login" ? "Portal Login" : "Create Account"}
                    </CardTitle>
                    <CardDescription>
                        {mode === "login"
                            ? "Login with your university email"
                            : "Register as a CR or Advisor using your DIU email"}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 text-blue-800 text-sm">
                        <InfoIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>Students do not need an account — use the search on the home page.</p>
                    </div>

                    {/* Role selector (register mode only) */}
                    {mode === "register" && (
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setRegisterRole("cr")}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                                    registerRole === "cr"
                                        ? "border-blue-600 bg-blue-50 text-blue-700"
                                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                                }`}
                            >
                                <Shield className="w-5 h-5" />
                                Apply as CR
                            </button>
                            <button
                                type="button"
                                onClick={() => setRegisterRole("advisor")}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                                    registerRole === "advisor"
                                        ? "border-blue-600 bg-blue-50 text-blue-700"
                                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                                }`}
                            >
                                <User className="w-5 h-5" />
                                Register as Advisor
                            </button>
                        </div>
                    )}

                    {/* Role info banner */}
                    {mode === "register" && (
                        <div className={`text-xs rounded-lg p-3 border ${
                            registerRole === "cr"
                                ? "bg-amber-50 border-amber-200 text-amber-800"
                                : "bg-green-50 border-green-200 text-green-800"
                        }`}>
                            {registerRole === "cr"
                                ? "CR applications require admin approval before access is granted."
                                : "Advisor accounts are auto-approved if your email is registered in the system."}
                        </div>
                    )}

                    {/* Full Name (register only) */}
                    {mode === "register" && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Full Name</label>
                            <Input
                                placeholder="Your full name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Email</label>
                        <Input
                            type="email"
                            placeholder={mode === "register" ? "name@diu.edu.bd" : "Enter your email"}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Password</label>
                            {mode === "login" && (
                                <Link href="/auth/forgot-password" className="text-xs text-blue-600 hover:underline">
                                    Forgot password?
                                </Link>
                            )}
                        </div>
                        <Input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {/* CR extra fields */}
                    {mode === "register" && registerRole === "cr" && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Your Student ID</label>
                                <Input
                                    placeholder="241-15-877"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Section You Want to Manage</label>
                                <Input
                                    placeholder="e.g. 66_A"
                                    value={sectionInterested}
                                    onChange={(e) => setSectionInterested(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    <Button
                        className="w-full h-11 gap-2 text-base"
                        onClick={mode === "login" ? handleLogin : handleRegister}
                        disabled={loading}
                    >
                        {loading
                            ? "Processing..."
                            : mode === "login"
                                ? <><KeyRound className="w-4 h-4" /> Login</>
                                : <><User className="w-4 h-4" /> Create Account</>
                        }
                    </Button>
                </CardContent>

                <CardFooter className="flex flex-col gap-2 text-center text-xs text-muted-foreground border-t pt-4">
                    <button
                        type="button"
                        className="text-blue-600 hover:underline text-sm"
                        onClick={toggleMode}
                    >
                        {mode === "login"
                            ? "Don't have an account? Register here"
                            : "Already have an account? Login"}
                    </button>
                    <p className="text-slate-400">Students search on the home page — no login needed.</p>
                </CardFooter>
            </Card>
        </div>
    );
}
