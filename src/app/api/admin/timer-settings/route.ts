import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseRouteClient } from '@/lib/supabase/server'

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

async function requireAdmin(request: NextRequest) {
    const response = NextResponse.next()
    const routeSupabase = createSupabaseRouteClient(request, response)
    const { data: { user } } = await routeSupabase.auth.getUser()

    if (!user?.email) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const adminClient = getAdminClient()
    const { data: staff } = await adminClient
        .from('authorized_staff')
        .select('role')
        .eq('email', user.email)
        .maybeSingle()

    if (!staff || !['admin', 'developer'].includes(staff.role)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }

    return { adminClient }
}

export async function GET(request: NextRequest) {
    const guard = await requireAdmin(request)
    if ('error' in guard) return guard.error

    const { data, error } = await guard.adminClient
        .from('system_settings')
        .select('timer_enabled, registration_start_at, registration_end_at, timezone')
        .eq('id', 1)
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data ?? { timer_enabled: false, registration_start_at: null, registration_end_at: null, timezone: 'Asia/Dhaka' } })
}

export async function POST(request: NextRequest) {
    const guard = await requireAdmin(request)
    if ('error' in guard) return guard.error

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    const { timer_enabled, registration_start_at, registration_end_at } = body

    const { error } = await guard.adminClient
        .from('system_settings')
        .upsert({
            id: 1,
            timer_enabled: Boolean(timer_enabled),
            registration_start_at: registration_start_at ?? null,
            registration_end_at: registration_end_at ?? null,
            timezone: 'Asia/Dhaka',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
