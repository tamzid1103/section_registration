import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

export async function POST(request: NextRequest) {
    const expectedSecret = process.env.AUTO_LOCK_CRON_SECRET
    if (!expectedSecret) {
        return NextResponse.json({ error: 'AUTO_LOCK_CRON_SECRET is not configured' }, { status: 500 })
    }

    const isVercelCron = request.headers.get('x-vercel-cron') === '1'
    const providedSecret = request.headers.get('x-cron-secret')
    if (!isVercelCron && providedSecret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAdminSupabaseClient()
    const nowIso = new Date().toISOString()

    const { data: dueSemesters, error: listError } = await supabase
        .from('semesters')
        .select('id, name, auto_lock_at')
        .eq('is_locked', false)
        .not('auto_lock_at', 'is', null)
        .lte('auto_lock_at', nowIso)

    if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    if (!dueSemesters || dueSemesters.length === 0) {
        return NextResponse.json({ success: true, lockedCount: 0, lockedSemesterIds: [] })
    }

    const semesterIds = dueSemesters.map((semester) => semester.id)

    const { error: lockError } = await supabase
        .from('semesters')
        .update({ is_locked: true, locked_at: nowIso })
        .in('id', semesterIds)

    if (lockError) {
        return NextResponse.json({ error: lockError.message }, { status: 500 })
    }

    await supabase.from('audit_logs').insert(
        dueSemesters.map((semester) => ({
            role: 'system',
            action: 'LOCK',
            note: `Auto-locked semester ${semester.name}`,
        }))
    )

    return NextResponse.json({
        success: true,
        lockedCount: semesterIds.length,
        lockedSemesterIds: semesterIds,
    })
}
