import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase/server'
import { resolveDestinationForEmail } from '@/lib/auth/resolve-destination'
import { isEmailPermitted } from '@/lib/auth-constants'

// OAuth / email-confirmation callback. Supabase sends the browser here with a
// one-time ?code, which only becomes a session once it is exchanged server-side.
// The exchange writes the auth cookies, so it must happen here — not on the client.

// ?next= is attacker-controllable, so only same-origin absolute paths are honoured.
function safeNext(next: string | null) {
    if (!next || !next.startsWith('/') || next.startsWith('//')) return null

    return next
}

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)

    // Behind Vercel/Cloudflare, request.url carries the internal origin — redirecting
    // to it would send the user somewhere they cannot reach.
    const forwardedHost = request.headers.get('x-forwarded-host')
    const baseUrl = process.env.NODE_ENV === 'development' || !forwardedHost
        ? origin
        : `https://${forwardedHost}`

    const redirectTo = (path: string) => NextResponse.redirect(new URL(path, baseUrl))
    const rejectWith = (reason: string) => `/auth/unauthorized?reason=${encodeURIComponent(reason)}`

    // Google reports a refusal (closed popup, denied consent) with no code at all.
    const providerError = searchParams.get('error_description') || searchParams.get('error')
    if (providerError) {
        return redirectTo(rejectWith(providerError))
    }

    const code = searchParams.get('code')
    if (!code) {
        return redirectTo('/auth/login')
    }

    // exchangeCodeForSession writes cookies through this carrier response. The real
    // destination depends on the user's role, which we only learn after the exchange,
    // so the cookies get copied onto whichever redirect we end up returning.
    const cookieCarrier = NextResponse.next()
    const supabase = createSupabaseRouteClient(request, cookieCarrier)

    const withCookies = (path: string) => {
        const response = redirectTo(path)
        for (const cookie of cookieCarrier.cookies.getAll()) {
            response.cookies.set(cookie)
        }

        return response
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    const email = data?.user?.email?.toLowerCase()

    // Exchange failures are our problem, not the user's (expired code, replayed code,
    // flow started in another browser). Keep the detail in the logs rather than the URL.
    if (error || !email) {
        console.error('[auth] code exchange failed:', error?.message || 'no email on session')
        return redirectTo(rejectWith('sign-in-failed'))
    }

    // signOut() below clears the cookies the exchange just set, and withCookies()
    // propagates that clearing — a rejected user must leave with no session.
    if (!isEmailPermitted(email)) {
        await supabase.auth.signOut()
        return withCookies(rejectWith('domain'))
    }

    const fullName = typeof data.user.user_metadata?.full_name === 'string'
        ? data.user.user_metadata.full_name
        : undefined

    const destination = await resolveDestinationForEmail(email, fullName)

    if (!destination) {
        await supabase.auth.signOut()
        return withCookies(rejectWith('not-registered'))
    }

    return withCookies(safeNext(searchParams.get('next')) ?? destination)
}
