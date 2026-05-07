import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// OAuth callback handler (required by Supabase PKCE flow)
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (code) {
        // The PKCE flow exchanges the code for a session via the client
        // Redirect to the destination with the code in the URL for client-side handling
        return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(`${origin}/auth/login`)
}
