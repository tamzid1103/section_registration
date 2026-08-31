export async function invalidateCacheScopes(scopes: string | string[]) {
    const scopeList = Array.isArray(scopes) ? scopes : [scopes]

    try {
        const response = await fetch('/api/cache/invalidate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ scopes: scopeList }),
        })

        if (!response.ok) {
            console.warn('Cache invalidation non-200 response:', response.status)
        }
    } catch (err) {
        console.warn('Cache invalidation request failed:', err)
    }
}
