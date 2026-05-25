import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { allowedDomains, developerAllowlist } from '@/lib/auth-constants'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const {
        data: { session },
    } = await supabase.auth.getSession()

    // 1. Domain Restriction Check for Login
    if (session?.user?.email) {
        const email = session.user.email
        const domain = email.split('@')[1]

        const { data: staffRecord } = await supabase
            .from('authorized_staff')
            .select('role')
            .eq('email', email)
            .maybeSingle()

        const isDeveloper = staffRecord?.role === 'developer'
        const isDeveloperEmail = developerAllowlist.includes(email.toLowerCase())
        const isDomainAllowed = allowedDomains.includes((domain || '').toLowerCase())

        if (!isDomainAllowed && !isDeveloperEmail) {
            await supabase.auth.signOut()
            return NextResponse.redirect(new URL('/auth/unauthorized', request.url))
        }

        // 2. CHECK AUTHORIZATION (NEW SECURITY LAYER)
        // Check if the user is in the authorized_staff table
        const staffPaths = ['/cr', '/advisor', '/admin', '/developer']
        const isTryingToAccessStaff = staffPaths.some(path => request.nextUrl.pathname.startsWith(path))

        if (isTryingToAccessStaff) {
            if (!staffRecord) {
                const { data: pending } = await supabase
                    .from('cr_applications')
                    .select('id')
                    .eq('email', email)
                    .eq('status', 'pending')
                    .maybeSingle()

                if (pending) {
                    return NextResponse.redirect(new URL('/auth/pending', request.url))
                }

                // Not a CR, Advisor, Admin, or Developer
                return NextResponse.redirect(new URL('/auth/unauthorized', request.url))
            }

            // Role-based routing
            const path = request.nextUrl.pathname
            if (path.startsWith('/developer') && staffRecord.role !== 'developer') {
                return NextResponse.redirect(new URL('/auth/unauthorized', request.url))
            }
            if (path.startsWith('/admin') && !['admin', 'developer'].includes(staffRecord.role)) {
                return NextResponse.redirect(new URL('/auth/unauthorized', request.url))
            }
            if (path.startsWith('/cr') && !['cr', 'admin', 'developer'].includes(staffRecord.role)) {
                return NextResponse.redirect(new URL('/auth/unauthorized', request.url))
            }
            if (path.startsWith('/advisor') && !['advisor', 'admin', 'developer'].includes(staffRecord.role)) {
                return NextResponse.redirect(new URL('/auth/unauthorized', request.url))
            }
        }
    }

    // 3. Protect routes - ensure user is logged in
    const protectedPaths = ['/dashboard', '/cr', '/advisor', '/admin', '/developer']
    if (protectedPaths.some(path => request.nextUrl.pathname.startsWith(path)) && !session) {
        return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    return response
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
