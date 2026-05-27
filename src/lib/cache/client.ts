export async function invalidateCacheScopes(scopes: string | string[]) {
    const scopeList = Array.isArray(scopes) ? scopes : [scopes]

    const response = await fetch('/api/cache/invalidate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scopes: scopeList }),
    })

    if (!response.ok) {
        throw new Error('Cache invalidation failed')
    }
}
