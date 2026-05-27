import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cacheScopeKeys } from '@/lib/cache/keys'
import { deleteCachedValues } from '@/lib/cache/redis'
import { createSupabaseRouteClient } from '@/lib/supabase/server'

function uniqueKeys(scopes: string[]) {
    const keys = new Set<string>()

    for (const scope of scopes) {
        const scopeKeys = cacheScopeKeys[scope] || []
        for (const key of scopeKeys) {
            keys.add(key)
        }
    }

    return [...keys]
}

export async function POST(request: NextRequest) {
    const response = NextResponse.next()
    const routeSupabase = createSupabaseRouteClient(request, response)
    const { data: { user } } = await routeSupabase.auth.getUser()

    if (!user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: staff } = await adminSupabase
        .from('authorized_staff')
        .select('role')
        .eq('email', user.email)
        .maybeSingle()

    if (!staff || !['cr', 'advisor', 'admin', 'developer'].includes(staff.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const scopes = Array.isArray(body.scopes)
        ? body.scopes
        : typeof body.scope === 'string'
            ? [body.scope]
            : ['home']

    const keys = uniqueKeys(scopes)
    const deletedCount = await deleteCachedValues(keys)

    return NextResponse.json({
        success: true,
        scopes,
        deletedKeys: keys,
        deletedCount,
    })
}
