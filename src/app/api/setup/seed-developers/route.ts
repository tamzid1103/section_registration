import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Visit /api/setup/seed-developers ONCE (or anytime) to upsert developer accounts.
// Safe to call multiple times — it will update passwords on existing accounts too.

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
        let userId: string | null = null
        let action = ''

        // 1. Try to create the user fresh
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: dev.email,
            password: dev.password,
            email_confirm: true,
            user_metadata: { full_name: dev.name },
        })

        if (!createErr && created.user) {
            userId = created.user.id
            action = 'created'
        } else if (createErr?.message?.includes('already been registered') || createErr?.message?.includes('already exists')) {
            // User exists — look up their ID and update their password
            const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
            if (listErr) {
                results.push({ email: dev.email, status: 'error', message: 'Could not list users: ' + listErr.message })
                continue
            }
            const existing = listData.users.find(u => u.email === dev.email)
            if (!existing) {
                results.push({ email: dev.email, status: 'error', message: 'User not found in list' })
                continue
            }
            userId = existing.id

            // Update password + ensure email is confirmed
            const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                password: dev.password,
                email_confirm: true,
            })
            if (updateErr) {
                results.push({ email: dev.email, status: 'error', message: 'Password update failed: ' + updateErr.message })
                continue
            }
            action = 'password reset to DevAdmin@2025'
        } else {
            results.push({ email: dev.email, status: 'error', message: createErr?.message || 'Unknown error' })
            continue
        }

        // 2. Upsert into authorized_staff (service role bypasses RLS)
        const { error: staffErr } = await supabaseAdmin
            .from('authorized_staff')
            .upsert(
                { email: dev.email, role: 'developer', name: dev.name },
                { onConflict: 'email' }
            )

        if (staffErr) {
            results.push({ email: dev.email, status: 'staff_error', message: staffErr.message, action })
        } else {
            results.push({ email: dev.email, status: 'ok', action })
        }
    }

    return NextResponse.json({
        results,
        instructions: 'Login at /auth/login — Password: DevAdmin@2025'
    })
}
