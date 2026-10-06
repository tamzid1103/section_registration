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
    UserCheck,
    ArrowLeft,
    Eye
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { getImpersonationSession, stopImpersonation } from "@/lib/impersonation"
import { ImpersonationBanner } from "@/components/impersonation-banner"

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
    const [isImpersonating, setIsImpersonating] = useState(false)

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

        // 1. Check authorized_staff first to know the real user's role
        const { data: staffData } = await supabase
            .from('authorized_staff')
            .select('role, name')
            .eq('email', user.email)
            .maybeSingle()

        // 2. Check for active impersonation (permitted only if real user is admin or developer)
        const impersonation = getImpersonationSession()
        const isRealAdmin = staffData && ['admin', 'developer'].includes(staffData.role)

        if (impersonation && isRealAdmin) {
            setRole(impersonation.role)
            setStaffName(impersonation.name)
            setUserEmail(impersonation.email)
            setCrSection(impersonation.section || null)
            setIsImpersonating(true)
            setLoaded(true)
            return
        } else if (impersonation && !isRealAdmin) {
            stopImpersonation()
        }
        setIsImpersonating(false)

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

        const handleImpersonationChange = () => {
            fetchUserAndRole()
        }
        window.addEventListener('diu:impersonation-change', handleImpersonationChange)
        return () => {
            window.removeEventListener('diu:impersonation-change', handleImpersonationChange)
        }
    }, [fetchUserAndRole])

    useEffect(() => {
        fetchPendingCount()
        if (!role || !['admin', 'developer'].includes(role)) return

        const ch = supabase.channel('sidebar-pending-apps')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cr_applications' }, fetchPendingCount)
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [role, fetchPendingCount])

    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setRole(null)
        router.push('/auth/login')
    }

    if (!isPortalRoute || !role) {
        return (
            <div className="min-h-screen flex flex-col bg-background text-foreground">
                <main className="flex-1">
                    {children}
                </main>
                <footer className="py-8 text-center text-xs text-muted-foreground border-t border-border/80 bg-background/50 mt-auto w-full space-y-1 print:hidden">
                    <p className="font-medium text-foreground/80">Developed &amp; Maintained by <strong className="text-foreground">Tamzidul Haque</strong></p>
                    <p className="text-muted-foreground">Department of Computer Science &amp; Engineering, Daffodil International University</p>
                    <p className="pt-1">
                        Need assistance? <a href="mailto:tamzid.social@gmail.com" className="text-primary font-medium hover:underline">tamzid.social@gmail.com</a>
                    </p>
                </footer>
            </div>
        )
    }

    const getNavLinks = (): NavItem[] => {
        if (isImpersonating) {
            const baseLinks: NavItem[] = []
            switch (role) {
                case 'cr':
                    baseLinks.push(
                        { href: '/cr/manage', label: 'CR Portal', icon: Users },
                        { href: '/', label: 'Live Public View', icon: Home },
                        { href: '/settings', label: 'Settings', icon: Settings },
                    )
                    break
                case 'advisor':
                    baseLinks.push(
                        { href: '/advisor', label: 'My Students', icon: GraduationCap },
                        { href: '/', label: 'Live Public View', icon: Home },
                        { href: '/settings', label: 'Settings', icon: Settings },
                    )
                    break
                case 'student':
                default:
                    baseLinks.push(
                        { href: '/student/dashboard', label: 'My Pre-Registration', icon: CheckCircle2 },
                        { href: '/', label: 'Live Public View', icon: Home },
                        { href: '/settings', label: 'Settings', icon: Settings },
                    )
                    break
            }
            baseLinks.push({ href: '/admin/impersonate', label: 'Exit to Admin Console', icon: ArrowLeft })
            return baseLinks
        }

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
                    { href: '/admin/impersonate', label: 'Impersonate User', icon: UserCheck },
                    { href: '/settings', label: 'Settings', icon: Settings },
                ]
            case 'developer':
                return [
                    { href: '/developer', label: 'Dev Console', icon: Code },
                    { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
                    { href: '/admin/impersonate', label: 'Impersonate User', icon: UserCheck },
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
        developer: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
        admin: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
        cr: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        advisor: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
        student: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    }

    const sidebarContent = (
        <div className="flex flex-col h-full bg-card border-r border-border/80">
            {/* Header / Brand */}
            <div className="p-4 border-b border-border/70 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2.5 font-bold text-foreground group">
                    <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs tracking-tight shadow-xs group-hover:scale-105 transition-transform">
                        DIU
                    </div>
                    <div>
                        <p className="text-xs font-bold tracking-tight text-foreground leading-none">Pre-Registration</p>
                        <p className="text-[10px] font-medium text-muted-foreground mt-0.5">Academic Portal</p>
                    </div>
                </Link>
                {mobileOpen && (
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
                <div className="px-2.5 pb-1.5 pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
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
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                                isActive
                                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                                <span className="truncate">{item.label}</span>
                            </div>
                            {item.badge !== undefined && (
                                <Badge className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center">
                                    {item.badge}
                                </Badge>
                            )}
                        </Link>
                    )
                })}
            </div>

            {/* User Identity & Theme at Bottom */}
            <div className="p-3 border-t border-border/70 bg-muted/30 space-y-2">
                {/* Theme Selector */}
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Theme</span>
                    <ThemeToggle variant="pills" />
                </div>

                <div className="p-2.5 rounded-lg bg-card border border-border shadow-2xs space-y-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-muted text-foreground flex items-center justify-center font-bold text-xs shrink-0 uppercase border border-border">
                            {staffName ? staffName.charAt(0) : 'U'}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-xs font-semibold text-foreground truncate leading-tight">{staffName || 'User'}</p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{userEmail}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                        <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant="outline" className={`text-[9px] font-mono uppercase font-semibold px-1.5 py-0.2 ${roleBadgeColors[role] || ''}`}>
                                {role}
                                {crSection ? ` (Sec ${crSection})` : ''}
                            </Badge>
                            {isImpersonating && (
                                <Badge className="bg-amber-600 text-white font-black text-[8px] px-1 py-0 uppercase">
                                    Impersonating
                                </Badge>
                            )}
                        </div>
                        <Link
                            href="/settings"
                            title="Account Settings"
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <Settings className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>

                <div className="flex gap-1.5">
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="flex-1 h-8 text-xs font-medium text-foreground bg-card border-border hover:bg-muted"
                    >
                        <Link href="/">
                            <Home className="w-3.5 h-3.5 mr-1 text-muted-foreground" /> Public Hub
                        </Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLogout}
                        className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 bg-card"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-background">
            {/* Desktop Fixed Sidebar */}
            <aside className="hidden md:flex w-60 flex-col fixed inset-y-0 left-0 z-40">
                {sidebarContent}
            </aside>

            {/* Mobile Top Header */}
            <header className="md:hidden sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border px-4 py-2.5 flex items-center justify-between shadow-2xs">
                <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
                    <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                        DIU
                    </div>
                    <span className="text-xs font-bold">Pre-Reg System</span>
                </Link>

                <div className="flex items-center gap-2">
                    <ThemeToggle variant="compact" />
                    {['admin', 'developer'].includes(role) && pendingCount > 0 && (
                        <Link href="/admin/users" className="flex items-center gap-1 bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-md text-[10px] font-bold animate-pulse">
                            <Bell className="w-3 h-3" /> {pendingCount}
                        </Link>
                    )}
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                        aria-label="Open sidebar"
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Mobile Slide-over Drawer */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    <div
                        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
                        onClick={() => setMobileOpen(false)}
                    />
                    <div className="relative w-4/5 max-w-xs flex-1 flex flex-col z-10">
                        {sidebarContent}
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 md:pl-60 flex flex-col min-w-0">
                <ImpersonationBanner />
                <main className="flex-1">
                    {children}
                </main>
                <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/70 bg-card/50 mt-auto w-full space-y-0.5 print:hidden">
                    <p className="font-medium text-foreground/80">Developed &amp; Maintained by <strong className="text-foreground">Tamzidul Haque</strong> (CSE, Daffodil International University)</p>
                    <p>Need help? <a href="mailto:tamzid.social@gmail.com" className="text-primary font-medium hover:underline">tamzid.social@gmail.com</a></p>
                </footer>
            </div>
        </div>
    )
}
