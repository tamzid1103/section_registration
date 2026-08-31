import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withRedisCache } from '@/lib/cache/redis'
import { cacheKeys } from '@/lib/cache/keys'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Set low cache TTL (2 seconds) so home page section counts update live
const HOME_CACHE_TTL_SECONDS = 2

async function loadHomeData() {
    // Use service role key for all home data queries to guarantee bypass of RLS restrictions
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const [sectionsResponse, registrationsResponse, advisorsResponse, settingsResponse] = await Promise.all([
        adminSupabase
            .from('sections')
            .select('id, name, capacity, semester_id, semesters!inner(name, is_active)')
            .eq('semesters.is_active', true)
            .order('name'),
        adminSupabase.from('registrations').select('section_id'),
        adminSupabase
            .from('advisors')
            .select('id, name, email, phone, designation, student_advisor_ranges(start_id, end_id)')
            .order('name'),
        adminSupabase
            .from('system_settings')
            .select('timer_enabled, registration_start_at, registration_end_at, timezone')
            .eq('id', 1)
            .maybeSingle(),
    ])

    const sections = (sectionsResponse.data || []).map((section: any) => ({
        ...section,
        current: registrationsResponse.data?.filter((registration) => registration.section_id === section.id).length || 0,
    }))

    return {
        sections,
        advisors: advisorsResponse.data || [],
        registrationTimer: {
            enabled: Boolean(settingsResponse.data?.timer_enabled),
            startAt: settingsResponse.data?.registration_start_at || null,
            endAt: settingsResponse.data?.registration_end_at || null,
            timezone: settingsResponse.data?.timezone || 'Asia/Dhaka',
        },
    }
}

export async function GET() {
    const cached = await withRedisCache(cacheKeys.home, HOME_CACHE_TTL_SECONDS, loadHomeData)

    return NextResponse.json(
        {
            data: cached.value,
            cache: cached.cacheStatus,
        },
        {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
            },
        }
    )
}
