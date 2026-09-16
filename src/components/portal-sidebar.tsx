"use client"

import { useEffect, useState, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import {
    LayoutDashboard,
    Layers,
    Calendar,
    GraduationCap,
    Users,
    BookOpen,
    ShieldAlert,
    Settings,
    Home,
    LogOut,
    Menu,
    X,
    Bell,
    CheckCircle2,
    Code,
    Sparkles,
    UserCheck
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

type NavItem = {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number | string
}

export function PortalSidebar({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() || ""
    const router = useRouter()
    const [role, setRole] = useState<string | null>(null)
    const [staffName, setStaffName] = useState<string | null>(null)
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const [crSection, setCrSection] = useState<string | null>(null)
    const [pendingCount, setPendingCount] = useState(0)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [loaded, setLoaded] = useState(false)

    const isPortalRoute =
        pathname.startsWith('/admin') ||
        pathname.startsWith('/developer') ||
        pathname.startsWith('/cr') ||
        pathname.startsWith('/advisor') ||
        pathname.startsWith('/student') ||
        pathname.startsWith('/settings')

    const fetchUserAndRole = useCallback(async () => {
        if (!isPortalRoute) {
            setLoaded(true)
            return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) {
            setRole(null)
            setLoaded(true)
            return
        }

        setUserEmail(user.email)

        // 1. Check authorized_staff first
        const { data: staffData } = await supabase
            .from('authorized_staff')
            .select('role, name')
            .eq('email', user.email)
            .maybeSingle()

        if (staffData) {
            setRole(staffData.role)
            setStaffName(staffData.name)

            if (staffData.role === 'cr') {
                const { data: appData } = await supabase
                    .from('cr_applications')
                    .select('section_interested')
                    .eq('email', user.email)
                    .eq('status', 'approved')
                    .maybeSingle()
                if (appData) setCrSection(appData.section_interested)
            }
        } else {
            // 2. Check allowed_students
            const { data: studentData } = await supabase
                .from('allowed_students')
                .select('name')
                .eq('email', user.email)
                .maybeSingle()

            if (studentData) {
                setRole('student')
                setStaffName(studentData.name)
            } else {
                // Check advisors
                const { data: advData } = await supabase
                    .from('advisors')
                    .select('name')
                    .eq('email', user.email)
                    .maybeSingle()

                if (advData) {
                    setRole('advisor')
                    setStaffName(advData.name)
                } else {
                    // Default open-domain student
                    setRole('student')
                    setStaffName(user.email.split('@')[0])
                }
            }
        }
        setLoaded(true)
    }, [isPortalRoute])

    const fetchPendingCount = useCallback(async () => {
        if (!role || !['admin', 'developer'].includes(role)) return
        const { count } = await supabase
            .from('cr_applications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
        setPendingCount(count || 0)
    }, [role])

    useEffect(() => {
        fetchUserAndRole()
    }, [fetchUserAndRole])

    useEffect(() => {
        fetchPendingCount()
        if (!role || !['admin', 'developer'].includes(role)) return

        const ch = supabase.channel('sidebar-pending-apps')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cr_applications' }, fetchPendingCount)
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [role, fetchPendingCount])

    // Close mobile menu on route change
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setRole(null)
        router.push('/auth/login')
    }

    // If not a portal page or not logged in, render children normally with public layout
    if (!isPortalRoute || !role) {
        return (
            <div className="min-h-screen flex flex-col">
                <main className="flex-1">
                    {children}
                </main>
                <footer className="py-8 text-center text-sm text-slate-500 bg-white border-t mt-auto w-full space-y-1 print:hidden">
                    <p className="font-medium text-slate-600">Developed & Maintained by</p>
                    <p className="font-bold text-slate-800 text-base">Tamzidul Haque</p>
                    <p className="text-slate-500">CSE, Daffodil International University</p>
                    <p className="pt-2">
                        Need help? Contact me at: <a href="mailto:tamzid.social@gmail.com" className="text-blue-600 font-medium hover:underline">tamzid.social@gmail.com</a>
                    </p>
                </footer>
            </div>
        )
    }

    // Navigation links tailored per role
    const getNavLinks = (): NavItem[] => {
        switch (role) {
            case 'admin':
                return [
                    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
                    { href: '/admin/sections', label: 'Manage Sections', icon: Layers },
                    { href: '/admin/semesters', label: 'Manage Semesters', icon: Calendar },
                    { href: '/admin/advisors', label: 'Manage Advisors', icon: GraduationCap },
                    { href: '/admin/eligible-students', label: 'Eligible Students', icon: Users },
                    { href: '/admin/courses', label: 'Offered Courses', icon: BookOpen },
                    { href: '/admin/users', label: 'Users & CR Approvals', icon: ShieldAlert, badge: pendingCount > 0 ? pendingCount : undefined },
                    { href: '/settings', label: 'Settings', icon: Settings },
                ]
            case 'developer':
                return [
                    { href: '/developer', label: 'Dev Console', icon: Code },
                    { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
                    { href: '/admin/users', label: 'Users & CR Approvals', icon: ShieldAlert, badge: pendingCount > 0 ? pendingCount : undefined },
                    { href: '/settings', label: 'Settings', icon: Settings },
                ]
            case 'cr':
                return [
                    { href: '/cr/manage', label: 'CR Portal', icon: Users },
                    { href: '/', label: 'Live Public View', icon: Home },
                    { href: '/settings', label: 'Settings', icon: Settings },
                ]
            case 'advisor':
                return [
                    { href: '/advisor', label: 'My Students', icon: GraduationCap },
                    { href: '/', label: 'Live Public View', icon: Home },
                    { href: '/settings', label: 'Settings', icon: Settings },
                ]
            case 'student':
            default:
                return [
                    { href: '/student/dashboard', label: 'My Pre-Registration', icon: CheckCircle2 },
                    { href: '/', label: 'Live Public View', icon: Home },
                    { href: '/settings', label: 'Settings', icon: Settings },
                ]
        }
    }

    const navLinks = getNavLinks()

    const roleBadgeColors: Record<string, string> = {
        developer: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 diu:bg-[#133E87]/70 diu:text-amber-300 diu:border-amber-400/40',
        admin: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 diu:bg-[#133E87]/70 diu:text-amber-300 diu:border-amber-400/40',
        cr: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 diu:bg-emerald-950/60 diu:text-emerald-300 diu:border-emerald-700/50',
        advisor: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 diu:bg-[#133E87]/70 diu:text-amber-300 diu:border-amber-400/40',
        student: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 diu:bg-[#07162C] diu:text-slate-200 diu:border-slate-700',
    }

    const sidebarContent = (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 diu:bg-[#051224] border-r border-slate-200/80 dark:border-slate-800 diu:border-[#133E87]/60 shadow-xs">
            {/* Header / Brand */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 diu:border-[#133E87]/50 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-white diu:text-white group">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-blue-500 diu:bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20 diu:shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                        DIU
                    </div>
                    <div>
                        <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white diu:text-white leading-none">Pre-Registration</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 diu:text-slate-300 mt-0.5">Management Portal</p>
                    </div>
                </Link>
                {mobileOpen && (
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 diu:hover:bg-[#0D284B]"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                <div className="px-3 pb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 diu:text-slate-400">
                        {role === 'admin' || role === 'developer' ? 'Administration' : 'Menu'}
                    </p>
                </div>
                {navLinks.map(item => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 dark:bg-blue-600 diu:bg-emerald-600 diu:text-white diu:shadow-emerald-600/30'
                                    : 'text-slate-600 dark:text-slate-300 diu:text-slate-300 hover:text-slate-900 dark:hover:text-white diu:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/70 diu:hover:bg-[#0D284B]'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 diu:text-slate-400'}`} />
                                <span className="truncate">{item.label}</span>
                            </div>
                            {item.badge !== undefined && (
                                <Badge className="bg-red-500 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full min-w-[20px] text-center">
                                    {item.badge}
                                </Badge>
                            )}
                        </Link>
                    )
                })}
            </div>

            {/* User Identity & Theme & Actions at Bottom */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 diu:border-[#133E87]/50 bg-slate-50/60 dark:bg-slate-950/40 diu:bg-[#07162C]/60 space-y-2">
                {/* Theme Selector */}
                <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 diu:text-slate-400">Theme</span>
                    <ThemeToggle variant="pills" />
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 diu:bg-[#0D233F] border border-slate-200/70 dark:border-slate-800 diu:border-[#133E87]/60 shadow-2xs space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 diu:from-emerald-600 diu:to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0 uppercase">
                            {staffName ? staffName.charAt(0) : 'U'}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-xs font-bold text-slate-900 dark:text-white diu:text-white truncate leading-tight">{staffName || 'User'}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 diu:text-slate-300 truncate mt-0.5">{userEmail}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 diu:border-[#133E87]/40">
                        <Badge variant="outline" className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 ${roleBadgeColors[role] || ''}`}>
                            {role}
                            {crSection ? ` (Sec ${crSection})` : ''}
                        </Badge>
                        <Link
                            href="/settings"
                            title="Account Settings"
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 diu:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 diu:hover:text-amber-300 hover:bg-blue-50 dark:hover:bg-slate-800 diu:hover:bg-[#133E87]/50 transition-colors"
                        >
                            <Settings className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                <div className="flex gap-1.5">
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="flex-1 text-xs text-slate-600 dark:text-slate-300 diu:text-slate-200 hover:text-slate-900 dark:hover:text-white diu:hover:text-white bg-white dark:bg-slate-900 diu:bg-[#0D233F] border-slate-200 dark:border-slate-800 diu:border-[#133E87]/60"
                    >
                        <Link href="/">
                            <Home className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400 diu:text-slate-300" /> Public Hub
                        </Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLogout}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 diu:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 diu:border-rose-900/60 bg-white dark:bg-slate-900 diu:bg-[#0D233F] px-2.5"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-50/40 dark:bg-slate-950 diu:bg-[#07162C]">
            {/* Desktop Fixed Sidebar */}
            <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 left-0 z-40">
                {sidebarContent}
            </aside>

            {/* Mobile Top Header */}
            <header className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 diu:bg-[#051224]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 diu:border-[#133E87]/60 px-4 py-3 flex items-center justify-between shadow-xs">
                <Link href="/" className="flex items-center gap-2 font-bold text-slate-900 dark:text-white diu:text-white">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 dark:bg-blue-500 diu:bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                        DIU
                    </div>
                    <span className="text-sm font-bold">Pre-Reg System</span>
                </Link>

                <div className="flex items-center gap-2">
                    <ThemeToggle variant="compact" />
                    {['admin', 'developer'].includes(role) && pendingCount > 0 && (
                        <Link href="/admin/users" className="flex items-center gap-1 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-1 rounded-lg text-xs font-bold animate-pulse">
                            <Bell className="w-3 h-3" /> {pendingCount}
                        </Link>
                    )}
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-2 rounded-lg text-slate-600 dark:text-slate-300 diu:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 diu:hover:bg-[#0D284B]"
                        aria-label="Open sidebar"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Mobile Slide-over Drawer */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    <div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                        onClick={() => setMobileOpen(false)}
                    />
                    <div className="relative w-4/5 max-w-xs flex-1 flex flex-col z-10">
                        {sidebarContent}
                    </div>
                </div>
            )}

            {/* Main Content Area with left offset on desktop */}
            <div className="flex-1 md:pl-64 flex flex-col min-w-0">
                <main className="flex-1">
                    {children}
                </main>
                <footer className="py-6 text-center text-xs text-slate-500 bg-white border-t mt-auto w-full space-y-0.5 print:hidden">
                    <p className="font-medium text-slate-600">Developed & Maintained by <strong className="text-slate-800">Tamzidul Haque</strong> (CSE, Daffodil International University)</p>
                    <p>Need help? <a href="mailto:tamzid.social@gmail.com" className="text-blue-600 font-medium hover:underline">tamzid.social@gmail.com</a></p>
                </footer>
            </div>
        </div>
    )
}
