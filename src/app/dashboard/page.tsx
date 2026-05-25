import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
    return (
        <div className="p-10 space-y-4">
            <h1 className="text-3xl font-bold">Portal Dashboard</h1>
            <p>Welcome! You have successfully logged in with a university email.</p>
            <div className="flex gap-4">
                <Button asChild>
                    <Link href="/cr/register">Go to Student Registration (CR)</Link>
                </Button>
            </div>
        </div>
    );
}
