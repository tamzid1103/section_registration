import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This route seeds the 2 developer accounts using the service role key.
// Visit /api/setup/seed-developers ONCE after running the fresh schema SQL.
// It is idempotent — safe to call multiple times.

const DEV_ACCOUNTS = [
    { email: 'tamzid.social@gmail.com', password: 'DevAdmin@2025', name: 'Developer One' },
    { email: 'tamjidul2003@gmail.com',  password: 'DevAdmin@2025', name: 'Developer Two' },
]

export async function GET() {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const results = []

    for (const dev of DEV_ACCOUNTS) {
        // 1. Create or retrieve auth user (email confirm bypassed via admin API)
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: dev.email,
            password: dev.password,
            email_confirm: true,   // mark as confirmed immediately
            user_metadata: { full_name: dev.name },
        })

        if (createErr && !createErr.message.includes('already been registered')) {
            results.push({ email: dev.email, status: 'error', message: createErr.message })
            continue
        }

        // 2. Upsert into authorized_staff (bypasses RLS via service role)
        const { error: staffErr } = await supabaseAdmin
            .from('authorized_staff')
            .upsert(
                { email: dev.email, role: 'developer', name: dev.name },
                { onConflict: 'email' }
            )

        if (staffErr) {
            results.push({ email: dev.email, status: 'staff_error', message: staffErr.message })
        } else {
            results.push({ email: dev.email, status: 'ok', note: createErr ? 'already existed, staff updated' : 'created fresh' })
        }
    }

    return NextResponse.json({ results, tip: 'Login at /auth/login with DevAdmin@2025' })
}
