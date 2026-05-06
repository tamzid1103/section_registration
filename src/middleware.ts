import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req, res })

    const {
        data: { session },
    } = await supabase.auth.getSession()

    // 1. Domain Restriction Check for Login
    if (session?.user?.email) {
        const domain = session.user.email.split('@')[1]
        const allowedDomains = ['diu.edu.bd', 'daffodilvarsity.edu.bd']

        if (!allowedDomains.includes(domain)) {
            await supabase.auth.signOut()
            return NextResponse.redirect(new URL('/auth/unauthorized', req.url))
        }
    }

    // 2. Protect routes (simple pattern for now)
    const dashboardPaths = ['/dashboard', '/cr', '/advisor', '/admin', '/developer']
    if (dashboardPaths.some(path => req.nextUrl.pathname.startsWith(path)) && !session) {
        return NextResponse.redirect(new URL('/auth/login', req.url))
    }

    return res
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
