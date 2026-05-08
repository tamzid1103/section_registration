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
    const [pendingCount, setPendingCount] = useState(0)

    const isPortalPage = pathname.startsWith('/cr') || pathname.startsWith('/advisor') ||
        pathname.startsWith('/admin') || pathname.startsWith('/developer')

    const fetchRole = useCallback(async () => {
        if (!isPortalPage) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) return
        const { data } = await supabase.from('authorized_staff').select('role').eq('email', user.email).single()
        if (data) setRole(data.role)
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
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b shadow-sm">
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

                <div className="flex items-center gap-2 shrink-0">
                    {['admin', 'developer'].includes(role) && pendingCount > 0 && (
                        <Link href="/admin/users" className="flex items-center gap-1 text-red-600 text-xs font-semibold animate-pulse">
                            <Bell className="w-3.5 h-3.5" /> {pendingCount} pending
                        </Link>
                    )}
                    <span className="text-xs text-slate-400 capitalize border border-slate-200 px-2 py-1 rounded-full">{role}</span>
                    <button onClick={handleLogout}
                        className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
                        <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                </div>
            </div>
        </nav>
    )
}
