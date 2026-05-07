"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

// Only shown when user is logged in AND on a portal page (not home/auth)
export function PortalNavigation() {
    const pathname = usePathname()
    const [role, setRole] = useState<string | null>(null)

    const isPortalPage = pathname.startsWith('/cr') ||
        pathname.startsWith('/advisor') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/developer')

    useEffect(() => {
        if (!isPortalPage) return
        async function fetchRole() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user?.email) return
            const { data } = await supabase
                .from('authorized_staff')
                .select('role')
                .eq('email', user.email)
                .single()
            if (data) setRole(data.role)
        }
        fetchRole()
    }, [pathname, isPortalPage])

    if (!isPortalPage || !role) return null

    const links: Record<string, { href: string; label: string }[]> = {
        developer: [
            { href: '/developer', label: 'Dev Console' },
            { href: '/admin', label: 'Admin' },
            { href: '/cr/manage', label: 'CR Portal' },
        ],
        admin: [
            { href: '/admin', label: 'Dashboard' },
            { href: '/admin/users', label: 'Users' },
            { href: '/admin/advisors', label: 'Advisors' },
            { href: '/admin/semesters', label: 'Semesters' },
            { href: '/admin/sections', label: 'Sections' },
        ],
        cr: [{ href: '/cr/manage', label: 'CR Portal' }],
        advisor: [{ href: '/advisor', label: 'Advisor Portal' }],
    }

    const navLinks = links[role] || []

    return (
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b shadow-sm">
            <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
                <Link href="/" className="font-bold text-blue-700 text-sm">DIU Pre-Reg</Link>
                <div className="flex items-center gap-1">
                    {navLinks.map(l => (
                        <Link
                            key={l.href}
                            href={l.href}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                pathname === l.href
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {l.label}
                        </Link>
                    ))}
                </div>
                <span className="text-xs text-slate-400 capitalize border border-slate-200 px-2 py-1 rounded-full">
                    {role}
                </span>
            </div>
        </nav>
    )
}
