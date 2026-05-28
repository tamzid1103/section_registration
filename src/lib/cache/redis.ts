import 'server-only'

import { createClient } from 'redis'

type CacheLoader<T> = () => Promise<T>

type RedisClient = ReturnType<typeof createClient>

// Promise resolves to a Redis client or null when unavailable
let redisClientPromise: Promise<RedisClient | null> | null = null

function getRedisUrl() {
    return process.env.REDIS_URL || process.env.REDIS_CONNECTION_URL || ''
}

async function getRedisClient() {
    const redisUrl = getRedisUrl()
    if (!redisUrl) return null

    if (!redisClientPromise) {
        try {
            const parsed = new URL(redisUrl)
            const host = parsed.hostname
            const port = parsed.port ? Number(parsed.port) : undefined
            const username = parsed.username || undefined
            const password = parsed.password || undefined
            const useTls = parsed.protocol === 'rediss:'

            const client = createClient({
                socket: {
                    host,
                    port,
                    // short connect timeout to fail fast in case of network issues
                    connectTimeout: 2000,
                    // When using TLS, provide SNI servername and allow toggling cert validation
                    tls: useTls ? true : undefined,
                    reconnectStrategy: (retries) => {
                        if (retries > 2) {
                            return false; // Stop retrying after 3 attempts
                        }
                        return 500; // Wait 500ms before retrying
                    },
                },
                username,
                password,
                // don't queue commands while offline to avoid request buildup
                disableOfflineQueue: true as any,
            })

            client.on('error', (error) => {
                console.error('[redis] client error', error)
            })

            // Ensure connect failures resolve to null instead of leaving a rejected promise
            redisClientPromise = client.connect()
                .then(() => client as RedisClient)
                .catch((err) => {
                    console.error('[redis] connect failed', err)
                    return null
                })
        } catch (err) {
            console.error('[redis] invalid REDIS_URL', err)
            return null
        }
    }

    return redisClientPromise
}

export async function getCachedValue<T>(key: string): Promise<T | null> {
    try {
        const client = await getRedisClient()
        if (!client) return null

        const value = await client.get(key)
        if (!value) return null

        return JSON.parse(value) as T
    } catch (err) {
        console.error('[redis] getCachedValue error', err)
        return null
    }
}

export async function setCachedValue<T>(key: string, value: T, ttlSeconds: number) {
    try {
        const client = await getRedisClient()
        if (!client) return false

        await client.setEx(key, ttlSeconds, JSON.stringify(value))
        return true
    } catch (err) {
        console.error('[redis] setCachedValue error', err)
        return false
    }
}

export async function deleteCachedValues(keys: string[]) {
    try {
        const client = await getRedisClient()
        if (!client || keys.length === 0) return 0

        return client.del(keys)
    } catch (err) {
        console.error('[redis] deleteCachedValues error', err)
        return 0
    }
}

export async function withRedisCache<T>(key: string, ttlSeconds: number, loader: CacheLoader<T>) {
    const cached = await getCachedValue<T>(key)
    if (cached !== null) {
        return { value: cached, cacheStatus: 'hit' as const }
    }

    const value = await loader()
    await setCachedValue(key, value, ttlSeconds)
    return { value, cacheStatus: 'miss' as const }
}
