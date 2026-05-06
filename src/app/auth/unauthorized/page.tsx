import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function UnauthorizedPage() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-destructive">
                <CardHeader className="text-center">
                    <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <ShieldAlert className="w-6 h-6 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-destructive">Access Denied</CardTitle>
                    <CardDescription>
                        Your email domain is not authorized.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Only official DIU email addresses (@diu.edu.bd or @daffodilvarsity.edu.bd) are allowed to access the management portal.
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
