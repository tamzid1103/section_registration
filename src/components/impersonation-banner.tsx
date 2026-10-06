"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, LogOut, ArrowRight, ShieldAlert, GraduationCap, Users, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getImpersonationSession, stopImpersonation, ImpersonationSession } from "@/lib/impersonation"
import { toast } from "sonner"
import Link from "next/link"

export function ImpersonationBanner() {
    const [session, setSession] = useState<ImpersonationSession | null>(null)
    const router = useRouter()

    useEffect(() => {
        // Initial check
        setSession(getImpersonationSession())

        // Listen for impersonation changes
        const handleImpersonationChange = (e: any) => {
            setSession(e.detail || null)
        }

        window.addEventListener('diu:impersonation-change', handleImpersonationChange)
        window.addEventListener('storage', () => {
            setSession(getImpersonationSession())
        })

        return () => {
            window.removeEventListener('diu:impersonation-change', handleImpersonationChange)
        }
    }, [])

    if (!session) return null

    const handleExit = () => {
        stopImpersonation()
        toast.success(`Exited impersonation. Returned to Admin mode.`)
        router.push('/admin/impersonate')
    }

    const getRoleIcon = () => {
        switch (session.role) {
            case 'advisor':
                return <GraduationCap className="w-4 h-4 text-amber-200" />
            case 'cr':
                return <Users className="w-4 h-4 text-emerald-200" />
            case 'student':
                return <CheckCircle2 className="w-4 h-4 text-sky-200" />
            default:
                return <Eye className="w-4 h-4 text-amber-200" />
        }
    }

    const roleLabels = {
        advisor: 'Faculty Advisor',
        cr: 'Class Representative (CR)',
        student: 'Student'
    }

    return (
        <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white border-b-2 border-amber-500/50 shadow-md sticky top-0 z-50 transition-all">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
                {/* Left side: Identity info */}
                <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start text-center sm:text-left">
                    <div className="flex items-center gap-1.5 bg-black/30 border border-white/20 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                        <Eye className="w-3 h-3" />
                        Admin Impersonation
                    </div>

                    <div className="flex items-center gap-1.5">
                        {getRoleIcon()}
                        <span className="font-extrabold text-white">
                            {roleLabels[session.role] || session.role}:
                        </span>
                        <span className="font-bold underline underline-offset-2 decoration-amber-300">
                            {session.name}
                        </span>
                        <span className="text-amber-200/90 font-mono text-[11px]">
                            ({session.studentId ? session.studentId : session.email})
                        </span>
                        {session.section && (
                            <Badge className="bg-white/20 text-white border-white/30 text-[10px] font-bold px-1.5 py-0">
                                Section {session.section}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Right side: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        href="/admin/impersonate"
                        className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-amber-200 hover:text-white underline underline-offset-2 transition-colors mr-1"
                    >
                        Switch User
                    </Link>

                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleExit}
                        className="h-7 text-xs font-black bg-white text-amber-950 hover:bg-amber-100 shadow-sm border border-amber-300 gap-1.5 px-3 rounded-lg"
                    >
                        <LogOut className="w-3.5 h-3.5 text-amber-900" />
                        Exit Impersonation
                    </Button>
                </div>
            </div>
        </div>
    )
}
