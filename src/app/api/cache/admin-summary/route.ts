import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cacheKeys } from '@/lib/cache/keys'
import { withRedisCache } from '@/lib/cache/redis'
import { createSupabaseRouteClient } from '@/lib/supabase/server'

const ADMIN_CACHE_TTL_SECONDS = 30

async function requireAdmin(request: NextRequest) {
    const response = NextResponse.next()
    const routeSupabase = createSupabaseRouteClient(request, response)
    const { data: { user } } = await routeSupabase.auth.getUser()

    if (!user?.email) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: staff } = await adminSupabase
        .from('authorized_staff')
        .select('role, name')
        .eq('email', user.email)
        .maybeSingle()

    if (!staff || !['admin', 'developer'].includes(staff.role)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }

    return { adminSupabase }
}

async function loadAdminSummary() {
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const [semRes, studRes, crRes, pendRes, logRes, advRes, histRes] = await Promise.all([
        adminSupabase.from('semesters').select('id, name').eq('is_active', true).maybeSingle(),
        adminSupabase.from('registrations').select('id', { count: 'exact', head: true }),
        adminSupabase.from('authorized_staff').select('id', { count: 'exact', head: true }).eq('role', 'cr'),
        adminSupabase.from('cr_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        adminSupabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(10),
        adminSupabase.from('advisors').select('id, name, registrations(id, advisor_completed)'),
        adminSupabase.from('semesters').select('id, name, is_active').order('created_at', { ascending: false }),
    ])

    const semId = semRes.data?.id
    const { count: secCount } = await adminSupabase
        .from('sections')
        .select('id', { count: 'exact', head: true })
        .eq('semester_id', semId || '')

    return {
        stats: {
            totalStudents: studRes.count || 0,
            activeSemester: semRes.data?.name || 'No Active Semester',
            sectionsCount: secCount || 0,
            crCount: crRes.count || 0,
            pendingApps: pendRes.count || 0,
        },
        auditLogs: logRes.data || [],
        advisorProgress: (advRes.data || []).map((advisor: any) => {
            const total = advisor.registrations?.length || 0
            const done = advisor.registrations?.filter((registration: any) => registration.advisor_completed)?.length || 0
            return {
                name: advisor.name,
                total,
                done,
                pct: total > 0 ? Math.round((done / total) * 100) : 0,
            }
        }),
        semesterHistory: histRes.data || [],
    }
}

export async function GET(request: NextRequest) {
    const guard = await requireAdmin(request)
    if ('error' in guard) return guard.error

    const cached = await withRedisCache(cacheKeys.adminSummary, ADMIN_CACHE_TTL_SECONDS, loadAdminSummary)

    return NextResponse.json({
        data: cached.value,
        cache: cached.cacheStatus,
    })
}
