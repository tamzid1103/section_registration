import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
        const domain = session.user.email.split('@')[1]
        const allowedDomains = ['diu.edu.bd', 'daffodilvarsity.edu.bd']

        if (!allowedDomains.includes(domain)) {
            await supabase.auth.signOut()
            return NextResponse.redirect(new URL('/auth/unauthorized', request.url))
        }
    }

    // 2. Protect routes
    const dashboardPaths = ['/dashboard', '/cr', '/advisor', '/admin', '/developer']
    if (dashboardPaths.some(path => request.nextUrl.pathname.startsWith(path)) && !session) {
        return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    return response
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
