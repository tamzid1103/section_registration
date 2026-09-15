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

async function loadAdminSummary(targetSemesterId?: string | null) {
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const [semestersRes, crRes, pendRes, logRes, advRes] = await Promise.all([
        adminSupabase.from('semesters').select('id, name, is_active, is_locked, created_at').order('created_at', { ascending: false }),
        adminSupabase.from('authorized_staff').select('id', { count: 'exact', head: true }).eq('role', 'cr'),
        adminSupabase.from('cr_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        adminSupabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(150),
        adminSupabase.from('advisors').select('id, name').order('name'),
    ])

    const allSemesters = semestersRes.data || []
    const selectedSemester = targetSemesterId
        ? (allSemesters.find((s: any) => s.id === targetSemesterId) || allSemesters.find((s: any) => s.is_active) || allSemesters[0])
        : (allSemesters.find((s: any) => s.is_active) || allSemesters[0])

    const selectedSemesterId = selectedSemester?.id || null

    let totalStudents = 0
    let sectionsCount = 0
    let semesterRegs: any[] = []

    if (selectedSemesterId) {
        const { data: secData } = await adminSupabase
            .from('sections')
            .select('id, name')
            .eq('semester_id', selectedSemesterId)
            .order('name')

        const sectionList = secData || []
        sectionsCount = sectionList.length
        const sectionIds = sectionList.map((s: any) => s.id)

        if (sectionIds.length > 0) {
            const { data: regsData } = await adminSupabase
                .from('registrations')
                .select('id, advisor_id, advisor_completed, section_id')
                .in('section_id', sectionIds)

            semesterRegs = regsData || []
            totalStudents = semesterRegs.length
        }
    }

    return {
        stats: {
            totalStudents,
            selectedSemesterId: selectedSemester?.id || null,
            selectedSemesterName: selectedSemester?.name || 'No Active Semester',
            isSelectedSemesterActive: Boolean(selectedSemester?.is_active),
            isSelectedSemesterLocked: Boolean(selectedSemester?.is_locked),
            sectionsCount,
            crCount: crRes.count || 0,
            pendingApps: pendRes.count || 0,
        },
        auditLogs: logRes.data || [],
        advisorProgress: (advRes.data || []).map((advisor: any) => {
            const advisorRegistrations = semesterRegs.filter((r: any) => r.advisor_id === advisor.id)
            const total = advisorRegistrations.length
            const done = advisorRegistrations.filter((r: any) => r.advisor_completed).length
            return {
                id: advisor.id,
                name: advisor.name,
                total,
                done,
                pct: total > 0 ? Math.round((done / total) * 100) : 0,
            }
        }),
        semesterHistory: allSemesters,
    }
}

export async function GET(request: NextRequest) {
    const guard = await requireAdmin(request)
    if ('error' in guard) return guard.error

    const semesterId = request.nextUrl.searchParams.get('semesterId')
    const cacheKey = cacheKeys.adminSummaryKey(semesterId)

    const cached = await withRedisCache(cacheKey, ADMIN_CACHE_TTL_SECONDS, () => loadAdminSummary(semesterId))

    return NextResponse.json({
        data: cached.value,
        cache: cached.cacheStatus,
    })
}

