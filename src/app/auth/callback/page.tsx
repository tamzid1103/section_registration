"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            const { data, error } = await supabase.auth.getSession();

            if (data?.session) {
                // Redirect to a default protected route
                router.push("/dashboard");
            } else {
                router.push("/auth/login?error=Session failed");
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium animate-pulse text-muted-foreground">Finalizing login...</p>
        </div>
    );
}
