"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allowedDomains, developerAllowlist } from "@/lib/auth-constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InfoIcon, Mail, KeyRound, User } from "lucide-react";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [sectionInterested, setSectionInterested] = useState("");
    const router = useRouter();

    const isDeveloperEmail = (value: string) => developerAllowlist.includes(value.toLowerCase());
    const isAllowedDomain = (value: string) => {
        const domain = value.split("@")[1] || "";
        return allowedDomains.includes(domain.toLowerCase());
    };

    const resolvePostLogin = async (userEmail: string) => {
        const { data: staffRecord } = await supabase
            .from("authorized_staff")
            .select("role")
            .eq("email", userEmail)
            .single();

        if (staffRecord?.role === "developer") return router.push("/developer");
        if (staffRecord?.role === "admin") return router.push("/admin");
        if (staffRecord?.role === "advisor") return router.push("/advisor");
        if (staffRecord?.role === "cr") return router.push("/cr/manage");

        const { data: pending } = await supabase
            .from("cr_applications")
            .select("id, status")
            .eq("email", userEmail)
            .eq("status", "pending")
            .maybeSingle();

        if (pending) return router.push("/auth/pending");
        return router.push("/auth/unauthorized");
    };

    const handleLogin = async () => {
        setLoading(true);
        setError(null);

        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !password) {
            setError("Email and password are required.");
            setLoading(false);
            return;
        }

        if (!isAllowedDomain(trimmedEmail) && !isDeveloperEmail(trimmedEmail)) {
            setError("Only DIU emails can login, except for fixed developer emails.");
            setLoading(false);
            return;
        }

        const { error } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        await resolvePostLogin(trimmedEmail);
        setLoading(false);
    };

    const handleRegister = async () => {
        setLoading(true);
        setError(null);

        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !password || !fullName) {
            setError("Full name, email, and password are required.");
            setLoading(false);
            return;
        }

        const isDev = isDeveloperEmail(trimmedEmail);
        if (!isAllowedDomain(trimmedEmail) && !isDev) {
            setError("Only DIU emails can register, except for fixed developer emails.");
            setLoading(false);
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        if (isDev) {
            if (!employeeId) {
                setError("Employee ID is required for developers.");
                setLoading(false);
                return;
            }

            await supabase.from("authorized_staff").upsert({
                email: trimmedEmail,
                role: "developer",
                name: fullName,
            }, { onConflict: "email" });

            await resolvePostLogin(trimmedEmail);
            setLoading(false);
            return;
        }

        if (!employeeId || !sectionInterested) {
            setError("Student ID and Section are required for CR registration.");
            setLoading(false);
            return;
        }

        await supabase.from("cr_applications").insert({
            user_id: data.user?.id,
            full_name: fullName,
            student_id: employeeId,
            email: trimmedEmail,
            section_interested: sectionInterested,
            status: "pending",
            applied_at: new Date().toISOString(),
        });

        router.push("/auth/pending");
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-primary">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Staff Portal Access</CardTitle>
                    <CardDescription>
                        Register or login with email and password. Students do not need an account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 text-blue-800 text-sm">
                        <InfoIcon className="w-5 h-5 flex-shrink-0" />
                        <p>Use your DIU email to continue</p>
                    </div>

                    {isRegister && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Full Name</label>
                            <Input
                                placeholder="Your full name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                    )}

                    {isRegister && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium">
                                {isDeveloperEmail(email.trim().toLowerCase()) ? "Employee ID (required)" : "Student ID (required)"}
                            </label>
                            <Input
                                placeholder={isDeveloperEmail(email.trim().toLowerCase()) ? "EMP-XXXX" : "241-15-877"}
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                            />
                        </div>
                    )}

                    {isRegister && !isDeveloperEmail(email.trim().toLowerCase()) && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Section Interested (required)</label>
                            <Input
                                placeholder="Section A"
                                value={sectionInterested}
                                onChange={(e) => setSectionInterested(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="space-y-3">
                        <label className="text-sm font-medium">Email</label>
                        <Input
                            type="email"
                            placeholder="name@diu.edu.bd"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium">Password</label>
                        <Input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <Button
                        className="w-full h-12 gap-2 text-base"
                        onClick={isRegister ? handleRegister : handleLogin}
                        disabled={loading}
                    >
                        {isRegister ? <User className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
                        {loading ? "Processing..." : isRegister ? "Create Account" : "Login"}
                    </Button>

                    {error && (
                        <p className="text-sm text-red-600 font-medium text-center">{error}</p>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-2 text-center text-xs text-muted-foreground border-t bg-slate-50/50 pt-4 rounded-b-lg">
                    <button
                        className="text-blue-600 hover:underline"
                        onClick={() => setIsRegister(!isRegister)}
                    >
                        {isRegister ? "Already have an account? Login" : "Don\'t have an account? Register"}
                    </button>
                    <p>Students do not need to login to use the Search Hub.</p>
                </CardFooter>
            </Card>
        </div>
    );
}
