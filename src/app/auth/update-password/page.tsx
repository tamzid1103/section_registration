"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LockKeyhole, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // When clicking the email link, Supabase will auto-authenticate the user via the URL hash
        // We just need to wait a tiny bit to make sure the session is established.
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                // If there's no session, they probably came here without clicking a valid email link
                // The hash processing might take a few milliseconds though, so we only throw error if 
                // there's absolutely no hash in the URL either.
                if (!window.location.hash.includes("access_token")) {
                    setError("No active reset session found. Please request a new password reset link.");
                }
            }
            setCheckingSession(false);
        });
        
        // Listen for the hash change auto-login
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN") {
                setError(null); // Clear errors if they successfully signed in via the link
            }
        });
        
        return () => subscription.unsubscribe();
    }, []);

    const handleUpdate = async () => {
        if (!password || password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            const { error: updateErr } = await supabase.auth.updateUser({
                password: password,
            });
            
            if (updateErr) {
                setError(updateErr.message);
            } else {
                setSuccess(true);
            }
        } catch (err: any) {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 p-4">
            <Card className="w-full max-w-md shadow-2xl border-t-4 border-blue-600">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-3 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <LockKeyhole className="w-6 h-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Set New Password</CardTitle>
                    <CardDescription>
                        Please enter your new password below.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                    {success ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-4">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                            <div>
                                <h3 className="font-bold text-green-800">Password Updated!</h3>
                                <p className="text-sm text-green-700 mt-1">
                                    Your password has been changed successfully.
                                </p>
                            </div>
                            <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white">
                                <Link href="/auth/login">Login with New Password</Link>
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">New Password</label>
                                <Input
                                    type="password"
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Confirm Password</label>
                                <Input
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-sm text-red-700 font-medium">{error}</p>
                                </div>
                            )}

                            <Button 
                                className="w-full h-11 gap-2 text-base bg-blue-600 hover:bg-blue-700" 
                                onClick={handleUpdate} 
                                disabled={loading || !!(error && error.includes("No active reset session"))}
                            >
                                {loading ? "Updating..." : "Update Password"}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
