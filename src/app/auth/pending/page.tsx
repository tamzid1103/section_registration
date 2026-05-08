import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Home } from "lucide-react"

// searchParams is async in Next.js 15+
export default async function PendingApprovalPage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string }>
}) {
    const params = await searchParams
    const type = params?.type || "cr"

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-amber-50 p-6">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-amber-400">
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                        <Clock className="w-8 h-8 text-amber-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Application Pending</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <p className="text-muted-foreground">
                        {type === "cr"
                            ? "Your CR application has been submitted and is awaiting admin approval. Login again after approval to access the CR portal."
                            : "Your advisor application is pending. Please check with the admin."}
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                        <strong>What happens next?</strong>
                        <p className="mt-1">
                            {type === "cr"
                                ? "An admin will review your CR application. Once approved, come back and login."
                                : "Contact admin if you believe your email should be in the advisor list."}
                        </p>
                    </div>
                    <Button asChild className="w-full gap-2">
                        <Link href="/"><Home className="w-4 h-4" /> Back to Home</Link>
                    </Button>
                    <Button variant="outline" asChild className="w-full">
                        <Link href="/auth/login">Try Logging In</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
