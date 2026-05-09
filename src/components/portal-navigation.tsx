"use client"

import { useEffect, useState, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { LogOut, Bell, Home } from "lucide-react"

export function PortalNavigation() {
    const pathname = usePathname()
    const router = useRouter()
    const [role, setRole] = useState<string | null>(null)
    const [staffName, setStaffName] = useState<string | null>(null)
    const [crSection, setCrSection] = useState<string | null>(null)
    const [pendingCount, setPendingCount] = useState(0)

    const isPortalPage = pathname.startsWith('/cr') || pathname.startsWith('/advisor') ||
        pathname.startsWith('/admin') || pathname.startsWith('/developer')

    const fetchRole = useCallback(async () => {
        if (!isPortalPage) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) return
        const { data } = await supabase.from('authorized_staff').select('role, name').eq('email', user.email).single()
        if (data) {
            setRole(data.role)
            setStaffName(data.name)
            if (data.role === 'cr') {
                const { data: appData } = await supabase.from('cr_applications').select('section_interested').eq('email', user.email).eq('status', 'approved').maybeSingle()
                if (appData) setCrSection(appData.section_interested)
            }
        }
    }, [isPortalPage])

    const fetchPendingCount = useCallback(async () => {
        if (!role || !['admin', 'developer'].includes(role)) return
        const { count } = await supabase.from('cr_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending')
        setPendingCount(count || 0)
    }, [role])

    useEffect(() => { fetchRole() }, [fetchRole])
    useEffect(() => {
        fetchPendingCount()
        if (!role || !['admin', 'developer'].includes(role)) return

        const ch = supabase.channel('pending-apps')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cr_applications' }, fetchPendingCount)
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [role, fetchPendingCount])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setRole(null)
        router.push('/auth/login')
    }

    if (!isPortalPage || !role) return null

    const links: Record<string, { href: string; label: string }[]> = {
        developer: [
            { href: '/developer', label: 'Dev Console' },
            { href: '/admin', label: 'Admin' },
            { href: '/admin/users', label: 'Users' },
        ],
        admin: [
            { href: '/admin', label: 'Dashboard' },
            { href: '/admin/users', label: 'Users' },
            { href: '/admin/advisors', label: 'Advisors' },
            { href: '/admin/semesters', label: 'Semesters' },
            { href: '/admin/sections', label: 'Sections' },
        ],
        cr: [{ href: '/cr/manage', label: 'CR Portal' }],
        advisor: [{ href: '/advisor', label: 'My Students' }],
    }

    const navLinks = links[role] || []

    return (
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b shadow-sm print:hidden">
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
                <Link href="/" className="flex items-center gap-1.5 font-bold text-blue-700 text-sm shrink-0">
                    <Home className="w-4 h-4" /> DIU Pre-Reg
                </Link>

                <div className="flex items-center gap-0.5 overflow-x-auto">
                    {navLinks.map(l => (
                        <Link key={l.href} href={l.href}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pathname === l.href
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}>
                            {l.href === '/admin/users' && pendingCount > 0 ? (
                                <span className="flex items-center gap-1">
                                    {l.label}
                                    <span className="bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">
                                        {pendingCount}
                                    </span>
                                </span>
                            ) : l.label}
                        </Link>
                    ))}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {['admin', 'developer'].includes(role) && pendingCount > 0 && (
                        <Link href="/admin/users" className="flex items-center gap-1 text-red-600 text-xs font-semibold animate-pulse mr-2">
                            <Bell className="w-3.5 h-3.5" /> {pendingCount} pending
                        </Link>
                    )}
                    <div className="flex flex-col items-end hidden sm:flex">
                        <span className="text-sm font-semibold text-slate-800 leading-tight">{staffName}</span>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{role}</span>
                            {crSection && <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 rounded-sm">Sec {crSection}</span>}
                        </div>
                    </div>
                    <button onClick={handleLogout}
                        className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors ml-1">
                        <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                </div>
            </div>
        </nav>
    )
}
