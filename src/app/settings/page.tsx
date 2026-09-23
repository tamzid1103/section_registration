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
            toast.error("New password and confirmation do not match.")
            return
        }

        setUpdatingPassword(true)

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (error) {
                toast.error(error.message || "Failed to update password.")
            } else {
                toast.success("Password updated successfully!")
                setNewPassword("")
                setConfirmPassword("")
            }
        } catch (err: any) {
            toast.error(err.message || "An unexpected error occurred.")
        } finally {
            setUpdatingPassword(false)
        }
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
    }

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-6">
                <div className="h-28 bg-muted/40 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-72 bg-muted/30 rounded-2xl animate-pulse" />
                    <div className="h-72 bg-muted/30 rounded-2xl animate-pulse" />
                </div>
            </div>
        )
    }

    if (!profile) return null

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            {/* 1. Header Profile Banner */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl uppercase tracking-wider shrink-0">
                        {profile.name.slice(0, 2)}
                    </div>
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{profile.name}</h1>
                            <Badge variant="outline" className="text-[10px] font-mono uppercase bg-primary/10 text-primary border-primary/30">
                                {profile.role}
                            </Badge>
                            {profile.crSection && (
                                <Badge variant="secondary" className="text-[10px]">
                                    Sec {profile.crSection}
                                </Badge>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 font-mono">
                                <Mail className="w-3.5 h-3.5" />
                                {profile.email}
                            </span>
                            {profile.studentId && (
                                <span className="flex items-center gap-1 font-mono">
                                    <User className="w-3.5 h-3.5" />
                                    ID: {profile.studentId}
                                </span>
                            )}
                            {profile.designation && (
                                <span className="flex items-center gap-1">
                                    <GraduationCap className="w-3.5 h-3.5" />
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
                        className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                    >
                        <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign Out
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2. Main Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Appearance & 3-Theme Selector */}
                    <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <Palette className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-foreground">Interface Appearance & Theme</h3>
                                <p className="text-xs text-muted-foreground">Choose your visual environment across all pages and portals.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {/* DIU Theme (Primary University Daylight Theme) */}
                            <button
                                type="button"
                                onClick={() => setTheme("diu")}
                                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between group ${
                                    theme === "diu"
                                        ? "border-emerald-600 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-xs"
                                        : "border-border/80 hover:border-border bg-card"
                                }`}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                            <GraduationCap className="w-4 h-4" />
                                        </div>
                                        {theme === "diu" && (
                                            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <p className="font-semibold text-xs sm:text-sm text-foreground">DIU Mode</p>
                                            <Badge className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0">DAY</Badge>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">Official DIU university daylight theme with Royal Navy &amp; Leaf Green.</p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-border/60 flex gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-full bg-[#0B3B60]" />
                                    <span className="w-3.5 h-3.5 rounded-full bg-[#008751]" />
                                    <span className="w-3.5 h-3.5 rounded-full bg-[#D97706]" />
                                </div>
                            </button>

                            {/* Night Mode */}
                            <button
                                type="button"
                                onClick={() => setTheme("dark")}
                                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between group ${
                                    theme === "dark"
                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                                        : "border-border/80 hover:border-border bg-card"
                                }`}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
                                            <Moon className="w-4 h-4" />
                                        </div>
                                        {theme === "dark" && (
                                            <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-xs sm:text-sm text-foreground">Night Mode</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">Midnight obsidian with neon teal highlights.</p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-border/60 flex gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-full bg-[#09090B] border border-zinc-700" />
                                    <span className="w-3.5 h-3.5 rounded-full bg-[#121215] border border-zinc-600" />
                                    <span className="w-3.5 h-3.5 rounded-full bg-[#14B8A6]" />
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Change Password Card */}
                    <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <KeyRound className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-foreground">Change Password</h3>
                                <p className="text-xs text-muted-foreground">Update your portal credentials securely.</p>
                            </div>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-3.5 pt-1">
                            <div className="space-y-1">
                                <Label htmlFor="new-password" className="text-xs font-medium text-muted-foreground">New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="new-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter new password (min. 6 chars)"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="pr-10 text-xs h-9"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground">Confirm New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirm-password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Re-enter new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pr-10 text-xs h-9"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        tabIndex={-1}
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-muted-foreground/70" />
                                    Encrypted via Supabase Auth
                                </span>
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={updatingPassword || !newPassword || !confirmPassword}
                                    className="text-xs font-medium"
                                >
                                    {updatingPassword ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                            Updating...
                                        </>
                                    ) : (
                                        "Update Password"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Academic Affiliation Card */}
                    <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-foreground">Academic Affiliation</h3>
                                <p className="text-xs text-muted-foreground">Department and system access permissions.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Institution</p>
                                <p className="font-semibold text-foreground">Daffodil International University</p>
                                <p className="text-muted-foreground text-[11px]">Dept. of Computer Science &amp; Engineering</p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Assigned Role</p>
                                <p className="font-semibold text-foreground capitalize">{profile.role}</p>
                                <p className="text-muted-foreground text-[11px]">
                                    {profile.role === 'admin' && 'Full administrative authority'}
                                    {profile.role === 'developer' && 'System architecture & engineering access'}
                                    {profile.role === 'cr' && `CR privileges for Section ${profile.crSection || 'Assigned'}`}
                                    {profile.role === 'advisor' && 'Faculty advising roster & student approvals'}
                                    {profile.role === 'student' && 'Section pre-registration & choice selection'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Right Sidebar Details */}
                <div className="space-y-6">
                    {/* Session Status Card */}
                    <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Active Session Status</span>
                        </div>
                        <div className="divide-y divide-border/60 pt-1">
                            <div className="flex items-center justify-between py-2">
                                <span className="text-muted-foreground">Verification</span>
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active &amp; Verified
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-muted-foreground">Auth Method</span>
                                <span className="font-mono text-foreground">Password / OTP</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-muted-foreground">Domain Policy</span>
                                <span className="font-mono text-foreground">@diu.edu.bd</span>
                            </div>
                        </div>
                    </div>

                    {/* Developer Support Card */}
                    <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                            <HelpCircle className="w-4 h-4 text-primary" />
                            <span>System Support</span>
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                            For technical issues, registration limits, or role inquiries, contact the lead engineer:
                        </p>
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                            <p className="font-semibold text-foreground text-xs">Tamzidul Haque</p>
                            <p className="text-[11px] text-muted-foreground">CSE, Daffodil International University</p>
                            <a
                                href="mailto:tamzid.social@gmail.com"
                                className="inline-block text-primary text-[11px] font-medium hover:underline pt-0.5"
                            >
                                tamzid.social@gmail.com
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
