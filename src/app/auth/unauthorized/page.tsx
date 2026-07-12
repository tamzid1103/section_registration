import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

// The callback rejects sign-ins for genuinely different reasons. A pre-authorized
// student who mistypes nothing but simply isn't on the roster yet should not be told
// their university email is the problem.
const reasons: Record<string, { title: string; description: string; detail: string }> = {
    domain: {
        title: "Access Denied",
        description: "Your email domain is not authorized.",
        detail: "Only official DIU email addresses (@diu.edu.bd or @daffodilvarsity.edu.bd) are allowed to access the portal. Please sign in with your university account.",
    },
    "not-registered": {
        title: "Not Registered Yet",
        description: "Your university email isn't on the authorized list.",
        detail: "Your DIU account is valid, but an admin has not added you as a student, advisor, or CR yet. Contact your admin to be added, then sign in again.",
    },
    "sign-in-failed": {
        title: "Sign-In Failed",
        description: "We couldn't complete your sign-in.",
        detail: "The sign-in link may have expired, already been used, or been started in a different browser. Please try signing in again.",
    },
    access_denied: {
        title: "Sign-In Cancelled",
        description: "You cancelled the Google sign-in.",
        detail: "You need to grant access to your DIU Google account to sign in. Please try again.",
    },
};

const fallback = {
    title: "Access Denied",
    description: "Your email domain is not authorized.",
    detail: "Only official DIU email addresses (@diu.edu.bd or @daffodilvarsity.edu.bd) are allowed to access the management portal.",
};

export default async function UnauthorizedPage({
    searchParams,
}: {
    searchParams: Promise<{ reason?: string }>;
}) {
    const { reason } = await searchParams;
    const { title, description, detail } = (reason && reasons[reason]) || fallback;

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-destructive">
                <CardHeader className="text-center">
                    <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <ShieldAlert className="w-6 h-6 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-destructive">{title}</CardTitle>
                    <CardDescription>
                        {description}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {detail}
                    </p>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button asChild className="w-full">
                        <Link href="/auth/login">Try Another Account</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/">Back to Home</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
