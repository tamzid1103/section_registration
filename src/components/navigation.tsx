import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, ShieldCheck, ArrowRight, TableProperties } from "lucide-react";

export default function Navigation() {
    return (
        <nav className="bg-white border-b sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <TableProperties className="w-5 h-5 text-white" />
                        </div>
                        <Link href="/" className="font-bold text-xl tracking-tight text-slate-900">
                            DIU <span className="text-blue-600">Pre-Reg</span>
                        </Link>
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" className="text-slate-600 font-medium">Student Hub</Button>
                        </Link>
                        <Link href="/cr/register">
                            <Button variant="ghost" className="text-slate-600 font-medium flex items-center gap-2">
                                <Users className="w-4 h-4" /> CR Portal
                            </Button>
                        </Link>
                        <Link href="/advisor">
                            <Button variant="ghost" className="text-slate-600 font-medium flex items-center gap-2">
                                <GraduationCap className="w-4 h-4" /> Advisor Hub
                            </Button>
                        </Link>
                        <Link href="/admin">
                            <Button className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4" /> Admin Console <ArrowRight className="w-3 h-3" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
