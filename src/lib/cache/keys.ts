export const cacheKeys = {
    home: 'section-registration:home:v1',
    adminSummary: 'section-registration:admin-summary:v1',
} as const

export const cacheScopeKeys: Record<string, readonly string[]> = {
    home: [cacheKeys.home],
    admin: [cacheKeys.home, cacheKeys.adminSummary],
    all: [cacheKeys.home, cacheKeys.adminSummary],
}
