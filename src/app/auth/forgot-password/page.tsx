"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleReset = async () => {
        if (!email.trim()) {
            setError("Please enter your email.");
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            // Tell Supabase to send a reset email. 
            // We set redirectTo to our update password page
            const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/auth/update-password`,
            });
            
            if (resetErr) {
                setError(resetErr.message);
            } else {
                setSuccess(true);
            }
        } catch (err: any) {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 p-4">
            <Card className="w-full max-w-md shadow-2xl border-t-4 border-blue-600">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-3 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Forgot Password</CardTitle>
                    <CardDescription>
                        Enter your email address to receive a password reset link.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                    {success ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-4">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                            <div>
                                <h3 className="font-bold text-green-800">Check your inbox</h3>
                                <p className="text-sm text-green-700 mt-1">
                                    We've sent a password reset link to <span className="font-semibold">{email}</span>.
                                </p>
                            </div>
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/auth/login">Return to Login</Link>
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Email Address</label>
                                <Input
                                    type="email"
                                    placeholder="Enter your registered email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-sm text-red-700 font-medium">{error}</p>
                                </div>
                            )}

                            <Button 
                                className="w-full h-11 gap-2 text-base bg-blue-600 hover:bg-blue-700" 
                                onClick={handleReset} 
                                disabled={loading}
                            >
                                {loading ? "Sending..." : "Send Reset Link"}
                            </Button>
                            
                            <div className="text-center mt-4">
                                <Link href="/auth/login" className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1">
                                    <ArrowLeft className="w-4 h-4" /> Back to Login
                                </Link>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
