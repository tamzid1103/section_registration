"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoIcon, Mail } from "lucide-react";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    prompt: "select_account",
                },
            },
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-primary">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Staff & CR Login</CardTitle>
                    <CardDescription>
                        Authorized access only for CRs, Advisors, and Admins.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 text-blue-800 text-sm">
                        <InfoIcon className="w-5 h-5 flex-shrink-0" />
                        <p>
                            Use your official university email ending with <span className="font-bold">@diu.edu.bd</span> or <span className="font-bold">@daffodilvarsity.edu.bd</span>
                        </p>
                    </div>

                    <Button
                        className="w-full h-12 gap-2 text-base"
                        onClick={handleLogin}
                        disabled={loading}
                    >
                        <Mail className="w-5 h-5" />
                        {loading ? "Connecting..." : "Sign in with Google"}
                    </Button>

                    {error && (
                        <p className="text-sm text-red-600 font-medium text-center">{error}</p>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-2 text-center text-xs text-muted-foreground border-t bg-slate-50/50 pt-4 rounded-b-lg">
                    <p>Don&apos;t have an account? Simply sign in to get started.</p>
                    <p>Students do not need to login to use the Search Hub.</p>
                </CardFooter>
            </Card>
        </div>
    );
}
