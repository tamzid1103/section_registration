import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { allowedDomains, developerAllowlist } from '@/lib/auth-constants'

// Server-side registration handler — uses service role to bypass RLS and email confirmation.
// Handles both 'cr' and 'advisor' registration types.

export async function POST(request: Request) {
    const body = await request.json()
    const { type, email, password, fullName, studentId, sectionInterested } = body

    const trimmedEmail = (email || '').trim().toLowerCase()

    // --- Validate email domain ---
    const domain = trimmedEmail.split('@')[1] || ''
    const isDev = developerAllowlist.includes(trimmedEmail)
    const isDomainAllowed = allowedDomains.includes(domain.toLowerCase())

    if (!isDomainAllowed && !isDev) {
        return NextResponse.json(
            { error: 'Only DIU university emails can register (@diu.edu.bd or @daffodilvarsity.edu.bd).' },
            { status: 400 }
        )
    }

    if (!trimmedEmail || !password || !fullName) {
        return NextResponse.json({ error: 'Full name, email, and password are required.' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // --- Step 1: Create auth user (email_confirm: true skips email verification) ---
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.createUser({
        email: trimmedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
    })

    if (userErr) {
        if (userErr.message.includes('already been registered') || userErr.message.includes('already exists')) {
            return NextResponse.json(
                { error: 'An account with this email already exists. Please login instead. (Use "Forgot Password" if needed).' }, 
                { status: 400 }
            )
        }
        return NextResponse.json({ error: userErr.message }, { status: 400 })
    }

    const userId = userData?.user?.id

    // ─── CR Registration ──────────────────────────────────────────────────────
    if (type === 'cr') {
        if (!studentId || !sectionInterested) {
            return NextResponse.json({ error: 'Student ID and section are required for CR registration.' }, { status: 400 })
        }

        // Check for existing application by email
        const { data: existingApp } = await supabaseAdmin
            .from('cr_applications')
            .select('id, status')
            .eq('email', trimmedEmail)
            .maybeSingle()

        if (existingApp) {
            return NextResponse.json(
                { error: `You already have a ${existingApp.status} CR application.` },
                { status: 409 }
            )
        }

        // Get user id if we had to look up existing
        let finalUserId: string | undefined = userId
        if (!finalUserId) {
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
            finalUserId = listData?.users.find(u => u.email === trimmedEmail)?.id
        }

        const { error: appErr } = await supabaseAdmin.from('cr_applications').insert({
            user_id: finalUserId ?? undefined,
            full_name: fullName,
            student_id: studentId,
            email: trimmedEmail,
            section_interested: sectionInterested,
            status: 'pending',
            applied_at: new Date().toISOString(),
        })

        if (appErr) {
            return NextResponse.json({ error: appErr.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, redirect: '/auth/pending?type=cr' })
    }

    // ─── Advisor Registration ─────────────────────────────────────────────────
    if (type === 'advisor') {
        // Check if email exists in the admin-managed advisor list
        const { data: advisorRecord } = await supabaseAdmin
            .from('advisors')
            .select('id, name')
            .eq('email', trimmedEmail)
            .maybeSingle()

        if (!advisorRecord) {
            // Clean up: delete the auth user we just created (since they can't be advisor)
            if (userId) await supabaseAdmin.auth.admin.deleteUser(userId)
            return NextResponse.json(
                { error: 'Your email is not in the advisor list. Contact admin to add your email first.' },
                { status: 403 }
            )
        }

        // Auto-approve: upsert into authorized_staff
        const { error: staffErr } = await supabaseAdmin.from('authorized_staff').upsert(
            { email: trimmedEmail, role: 'advisor', name: fullName },
            { onConflict: 'email' }
        )

        if (staffErr) {
            return NextResponse.json({ error: staffErr.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, redirect: '/advisor' })
    }

    return NextResponse.json({ error: 'Invalid registration type.' }, { status: 400 })
}
