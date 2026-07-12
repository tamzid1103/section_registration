import 'server-only'

import { createClient } from '@supabase/supabase-js'

const roleHome: Record<string, string> = {
    developer: '/developer',
    admin: '/admin',
    advisor: '/advisor',
    cr: '/cr/manage',
    student: '/student/dashboard',
}

// Where a signed-in user belongs, provisioning them on first sign-in if they are
// pre-authorized. Mirrors redirectByRole() on the home page, but runs with the
// service role: an OAuth user has no authorized_staff row yet, and the browser
// must not be the thing that grants itself one.
//
// Returns null when the email matches no record at all — the caller rejects the
// sign-in rather than leaving someone with a session and nowhere to go.
export async function resolveDestinationForEmail(email: string, fallbackName?: string) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: staff } = await supabase
        .from('authorized_staff')
        .select('role')
        .eq('email', email)
        .maybeSingle()

    if (staff?.role && roleHome[staff.role]) {
        return roleHome[staff.role]
    }

    const { data: allowedStudent } = await supabase
        .from('allowed_students')
        .select('name')
        .eq('email', email)
        .maybeSingle()

    if (allowedStudent) {
        await supabase.from('authorized_staff').upsert(
            { email, role: 'student', name: allowedStudent.name || fallbackName || email },
            { onConflict: 'email' }
        )
        return roleHome.student
    }

    const { data: advisor } = await supabase
        .from('advisors')
        .select('name')
        .eq('email', email)
        .maybeSingle()

    if (advisor) {
        await supabase.from('authorized_staff').upsert(
            { email, role: 'advisor', name: advisor.name || fallbackName || email },
            { onConflict: 'email' }
        )
        return roleHome.advisor
    }

    const { data: pendingApplication } = await supabase
        .from('cr_applications')
        .select('id')
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle()

    if (pendingApplication) {
        return '/auth/pending?type=cr'
    }

    return null
}
