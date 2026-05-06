import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in search params, use it as the redirection URL
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return request.headers.get('cookie')?.split('; ')?.find(c => c.startsWith(`${name}=`))?.split('=')[1]
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        // Not strictly needed in callback as we redirect immediately
                    },
                    remove(name: string, options: CookieOptions) {
                        // Not strictly needed in callback as we redirect immediately
                    },
                },
            }
        )
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const { data: { user } } = await supabase.auth.getUser()

            if (user?.email) {
                const { data: staffRecord } = await supabase
                    .from('authorized_staff')
                    .select('role')
                    .eq('email', user.email)
                    .single()

                if (staffRecord) {
                    if (staffRecord.role === 'admin') return NextResponse.redirect(`${origin}/admin`)
                    if (staffRecord.role === 'advisor') return NextResponse.redirect(`${origin}/advisor`)
                    if (staffRecord.role === 'cr') return NextResponse.redirect(`${origin}/cr/manage`)
                }
            }

            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
