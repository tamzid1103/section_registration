import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withRedisCache } from '@/lib/cache/redis'
import { cacheKeys } from '@/lib/cache/keys'

const HOME_CACHE_TTL_SECONDS = 60

async function loadHomeData() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const [sectionsResponse, registrationsResponse, advisorsResponse, settingsResponse] = await Promise.all([
        supabase
            .from('sections')
            .select('id, name, capacity, semester_id, semesters!inner(name, is_active)')
            .eq('semesters.is_active', true)
            .order('name'),
        supabase.from('registrations').select('section_id'),
        supabase
            .from('advisors')
            .select('id, name, email, phone, designation, student_advisor_ranges(start_id, end_id)')
            .order('name'),
        supabase
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

    return NextResponse.json({
        data: cached.value,
        cache: cached.cacheStatus,
    })
}
