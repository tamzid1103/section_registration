"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useTheme, Theme } from "@/components/theme-provider"
import {
    KeyRound,
    User,
    Shield,
    CheckCircle2,
    Eye,
    EyeOff,
    Loader2,
    Sparkles,
    Mail,
    GraduationCap,
    Lock,
    Building2,
    LogOut,
    HelpCircle,
    Info,
    Calendar,
    Sun,
    Moon,
    Check,
    Palette
} from "lucide-react"
import { toast } from "sonner"

interface UserProfile {
    email: string
    name: string
    role: 'developer' | 'admin' | 'cr' | 'advisor' | 'student'
    studentId?: string | null
    crSection?: string | null
    designation?: string | null
    cabin?: string | null
    createdAt?: string | null
}

export default function SettingsPage() {
    const router = useRouter()
    const { theme, setTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<UserProfile | null>(null)

    // Password reset form state
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [updatingPassword, setUpdatingPassword] = useState(false)

    const fetchUserProfile = useCallback(async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user || !user.email) {
            router.push('/auth/login')
            return
        }

        const email = user.email
        let resolvedProfile: UserProfile = {
            email,
            name: email.split('@')[0],
            role: 'student',
            createdAt: user.created_at,
        }

        // 1. Check authorized_staff
        const { data: staff } = await supabase
            .from('authorized_staff')
            .select('role, name, created_at')
            .eq('email', email)
            .maybeSingle()

        if (staff) {
            resolvedProfile.name = staff.name || resolvedProfile.name
            resolvedProfile.role = staff.role as UserProfile['role']
            if (staff.created_at) resolvedProfile.createdAt = staff.created_at

            if (staff.role === 'cr') {
                const { data: appData } = await supabase
                    .from('cr_applications')
                    .select('section_interested, student_id')
                    .eq('email', email)
                    .eq('status', 'approved')
                    .maybeSingle()

                if (appData) {
                    resolvedProfile.crSection = appData.section_interested
                    resolvedProfile.studentId = appData.student_id
                }
            }
        } else {
            // 2. Check allowed_students
            const { data: student } = await supabase
                .from('allowed_students')
                .select('name, student_id')
                .eq('email', email)
                .maybeSingle()

            if (student) {
                resolvedProfile.role = 'student'
                resolvedProfile.name = student.name || resolvedProfile.name
                resolvedProfile.studentId = student.student_id
            } else {
                // 3. Check advisors
                const { data: adv } = await supabase
                    .from('advisors')
                    .select('name, designation, cabin')
                    .eq('email', email)
                    .maybeSingle()

                if (adv) {
                    resolvedProfile.role = 'advisor'
                    resolvedProfile.name = adv.name || resolvedProfile.name
                    resolvedProfile.designation = adv.designation
                    resolvedProfile.cabin = adv.cabin
                } else {
                    // Check if DIU student email pattern like 211-15-1234@diu.edu.bd
                    const prefix = email.split('@')[0]
                    if (/^\d{3}-\d{2}-\d{4,5}$/.test(prefix)) {
                        resolvedProfile.studentId = prefix
                    }
                }
            }
        }

        setProfile(resolvedProfile)
        setLoading(false)
    }, [router])

    useEffect(() => {
        fetchUserProfile()
    }, [fetchUserProfile])

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!newPassword || !confirmPassword) {
            toast.error("Please fill out both password fields.")
            return
        }

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters long.")
            return
        }

        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match.")
            return
        }

        setUpdatingPassword(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (error) {
                toast.error(`Failed to update password: ${error.message}`)
            } else {
                toast.success("Password updated successfully!")
                setNewPassword("")
                setConfirmPassword("")
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "An unexpected error occurred"
            toast.error(`Error: ${msg}`)
        } finally {
            setUpdatingPassword(false)
        }
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
    }

    const roleBadges: Record<UserProfile['role'], { label: string; color: string }> = {
        developer: { label: 'System Developer', color: 'bg-purple-100 text-purple-700 border-purple-200' },
        admin: { label: 'Administrator', color: 'bg-blue-100 text-blue-700 border-blue-200' },
        cr: { label: 'Class Representative', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        advisor: { label: 'Faculty Advisor', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
        student: { label: 'DIU Student', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                    <p className="text-sm font-medium text-slate-500">Loading your profile & settings...</p>
                </div>
            </div>
        )
    }

    if (!profile) return null

    const currentRoleInfo = roleBadges[profile.role] || { label: profile.role.toUpperCase(), color: 'bg-slate-100 text-slate-700 border-slate-200' }

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Top Header / Breadcrumb */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Account & Portal Settings</h1>
                <p className="text-sm text-slate-500 mt-1">Manage your security credentials, profile information, and account preferences.</p>
            </div>

            {/* 1. User Identity Header Card */}
            <Card className="border-slate-200/80 shadow-xs bg-gradient-to-br from-white via-slate-50/50 to-blue-50/20 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/5 rounded-full blur-3xl pointer-events-none" />
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-start sm:items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-500/20 uppercase shrink-0">
                                {profile.name ? profile.name.charAt(0) : 'U'}
                            </div>
                            <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">{profile.name}</h2>
                                    <Badge variant="outline" className={`font-semibold text-xs px-2.5 py-0.5 ${currentRoleInfo.color}`}>
                                        <Sparkles className="w-3 h-3 mr-1" /> {currentRoleInfo.label}
                                    </Badge>
                                    {profile.crSection && (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs font-semibold">
                                            Section {profile.crSection}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                                    <span className="flex items-center gap-1">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                        {profile.email}
                                    </span>
                                    {profile.studentId && (
                                        <span className="flex items-center gap-1 font-mono">
                                            <User className="w-3.5 h-3.5 text-slate-400" />
                                            ID: {profile.studentId}
                                        </span>
                                    )}
                                    {profile.designation && (
                                        <span className="flex items-center gap-1">
                                            <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                                            {profile.designation} {profile.cabin ? `(Cabin: ${profile.cabin})` : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSignOut}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                            >
                                <LogOut className="w-4 h-4 mr-1.5" /> Sign Out
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2. Main Column (2 cols on large screen) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Appearance & 3-Theme Selector */}
                    <Card className="border-slate-200/80 shadow-xs">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 diu:bg-emerald-950 diu:text-emerald-400">
                                    <Palette className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-900 dark:text-white diu:text-white">Appearance & Theme</CardTitle>
                                    <CardDescription>Choose your preferred interface theme across all portals and pages.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Day Mode Card */}
                                <button
                                    type="button"
                                    onClick={() => setTheme("light")}
                                    className={`relative p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between group ${
                                        theme === "light"
                                            ? "border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm ring-2 ring-amber-500/20"
                                            : "border-slate-200 dark:border-slate-800 diu:border-[#133E87]/60 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 diu:bg-[#0D233F]"
                                    }`}
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                                                <Sun className="w-5 h-5" />
                                            </div>
                                            {theme === "light" && (
                                                <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white diu:text-white">Day Mode</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 diu:text-slate-300">Clean daylight slate with crisp contrast.</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 diu:border-[#133E87]/40 flex gap-1.5">
                                        <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-300 shadow-2xs" />
                                        <span className="w-4 h-4 rounded-full bg-white border border-slate-200 shadow-2xs" />
                                        <span className="w-4 h-4 rounded-full bg-blue-600" />
                                    </div>
                                </button>

                                {/* Night Mode Card */}
                                <button
                                    type="button"
                                    onClick={() => setTheme("dark")}
                                    className={`relative p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between group ${
                                        theme === "dark"
                                            ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/30 shadow-sm ring-2 ring-blue-500/20"
                                            : "border-slate-200 dark:border-slate-800 diu:border-[#133E87]/60 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 diu:bg-[#0D233F]"
                                    }`}
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="p-2 rounded-xl bg-slate-800 text-blue-400">
                                                <Moon className="w-5 h-5" />
                                            </div>
                                            {theme === "dark" && (
                                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white diu:text-white">Night Mode</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 diu:text-slate-300">Midnight obsidian with neon blue accents.</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 diu:border-[#133E87]/40 flex gap-1.5">
                                        <span className="w-4 h-4 rounded-full bg-[#0B0F17] border border-slate-700" />
                                        <span className="w-4 h-4 rounded-full bg-[#111827] border border-slate-600" />
                                        <span className="w-4 h-4 rounded-full bg-blue-500" />
                                    </div>
                                </button>

                                {/* DIU Mode Card */}
                                <button
                                    type="button"
                                    onClick={() => setTheme("diu")}
                                    className={`relative p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between group ${
                                        theme === "diu"
                                            ? "border-emerald-500 bg-emerald-950/20 shadow-sm ring-2 ring-emerald-500/25"
                                            : "border-slate-200 dark:border-slate-800 diu:border-[#133E87]/60 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 diu:bg-[#0D233F]"
                                    }`}
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="p-2 rounded-xl bg-emerald-900/60 text-amber-300 border border-emerald-700/50">
                                                <GraduationCap className="w-5 h-5" />
                                            </div>
                                            {theme === "diu" && (
                                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white diu:text-white">DIU Theme</p>
                                                <Badge className="bg-amber-400 text-slate-950 text-[9px] font-black px-1 py-0">OFFICIAL</Badge>
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 diu:text-slate-300">DIU Navy, Leaf Green & Daffodil Gold.</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 diu:border-[#133E87]/40 flex gap-1.5">
                                        <span className="w-4 h-4 rounded-full bg-[#07162C] border border-[#133E87]" />
                                        <span className="w-4 h-4 rounded-full bg-[#10B981]" />
                                        <span className="w-4 h-4 rounded-full bg-[#FBBF24]" />
                                    </div>
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200/80 shadow-xs">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                                    <KeyRound className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-900">Change Password</CardTitle>
                                    <CardDescription>Update your portal login password directly.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePasswordChange} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="new-password">New Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="new-password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter new password (min. 6 characters)"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="pr-10"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-500">Must be at least 6 characters long.</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="confirm-password"
                                            type={showConfirmPassword ? "text" : "password"}
                                            placeholder="Re-enter new password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="pr-10"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            tabIndex={-1}
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 flex items-center justify-between">
                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                                        Encrypted via Supabase Auth
                                    </span>
                                    <Button
                                        type="submit"
                                        disabled={updatingPassword || !newPassword || !confirmPassword}
                                        className="bg-blue-600 hover:bg-blue-700 font-semibold"
                                    >
                                        {updatingPassword ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Updating...
                                            </>
                                        ) : (
                                            "Update Password"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Account Overview & DIU Affiliation */}
                    <Card className="border-slate-200/80 shadow-xs">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-900">Academic & Institutional Info</CardTitle>
                                    <CardDescription>Affiliation details registered in the pre-registration system.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Institution</p>
                                    <p className="font-bold text-slate-900 mt-0.5">Daffodil International University</p>
                                    <p className="text-xs text-slate-500">Department of Computer Science & Engineering</p>
                                </div>
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Role</p>
                                    <p className="font-bold text-slate-900 mt-0.5 capitalize">{profile.role}</p>
                                    <p className="text-xs text-slate-500">
                                        {profile.role === 'admin' && 'Full administrative authority'}
                                        {profile.role === 'developer' && 'System architecture & debugging access'}
                                        {profile.role === 'cr' && `CR privileges for Section ${profile.crSection || 'Assigned'}`}
                                        {profile.role === 'advisor' && 'Advising & student progress monitoring'}
                                        {profile.role === 'student' && 'Section pre-registration & verification'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 3. Right Sidebar Details */}
                <div className="space-y-6">
                    {/* Session & Security Info */}
                    <Card className="border-slate-200/80 shadow-xs">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-emerald-600" />
                                <CardTitle className="text-sm font-bold text-slate-900">Active Session</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs">
                            <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <span className="text-slate-500">Session Status</span>
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Active & Verified
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <span className="text-slate-500">Authentication</span>
                                <span className="font-medium text-slate-800">Email OTP / Password</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-slate-500">Domain Policy</span>
                                <span className="font-medium text-slate-800">@diu.edu.bd</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Developer Support & Maintainer */}
                    <Card className="border-slate-200/80 shadow-xs bg-slate-900 text-white">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 text-blue-400">
                                <HelpCircle className="w-4 h-4" />
                                <CardTitle className="text-sm font-bold text-white">System Support</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs text-slate-300">
                            <p>
                                If you experience any system issues, permission errors, or need guidance, reach out to the maintainer:
                            </p>
                            <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80 space-y-1">
                                <p className="font-bold text-white text-sm">Tamzidul Haque</p>
                                <p className="text-xs text-slate-400">CSE, Daffodil International University</p>
                                <a
                                    href="mailto:tamzid.social@gmail.com"
                                    className="inline-block text-blue-400 font-medium hover:underline pt-1"
                                >
                                    tamzid.social@gmail.com
                                </a>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
