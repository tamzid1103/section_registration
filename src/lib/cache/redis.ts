import 'server-only'

import { createClient } from 'redis'

type CacheLoader<T> = () => Promise<T>

type RedisClient = ReturnType<typeof createClient>

// While Redis is unreachable, stop dialling it for this long. Without a cooldown
// every request pays the full connect timeout; with it, only one request per
// window does, and the cache recovers on its own once Redis is back.
const CIRCUIT_COOLDOWN_MS = 60_000

// Promise resolves to a Redis client or null when unavailable
let redisClientPromise: Promise<RedisClient | null> | null = null
let activeClient: RedisClient | null = null
let circuitOpenUntil = 0
let failureLogged = false

function getRedisUrl() {
    return process.env.REDIS_URL || process.env.REDIS_CONNECTION_URL || ''
}

// Drop the client and refuse new connections until the cooldown expires. The next
// call after that reconnects from scratch, so a transient outage no longer disables
// caching for the life of the process.
function tripCircuit(reason: string, error: unknown) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS
    redisClientPromise = null

    if (activeClient) {
        const client = activeClient
        activeClient = null
        try {
            client.destroy()
        } catch {
            // already closed — nothing to release
        }
    }

    // node-redis emits 'error' for every failed socket attempt, so log only the
    // first failure of an outage rather than one line per retry.
    if (!failureLogged) {
        failureLogged = true
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[redis] ${reason}: ${message} — cache bypassed, retrying in ${CIRCUIT_COOLDOWN_MS / 1000}s`)
    }
}

async function getRedisClient() {
    const redisUrl = getRedisUrl()
    if (!redisUrl) return null

    if (Date.now() < circuitOpenUntil) return null

    if (!redisClientPromise) {
        try {
            const parsed = new URL(redisUrl)

            const client = createClient({
                socket: {
                    host: parsed.hostname,
                    port: parsed.port ? Number(parsed.port) : undefined,
                    // short connect timeout to fail fast in case of network issues
                    connectTimeout: 2000,
                    tls: parsed.protocol === 'rediss:' ? true : undefined,
                    // The circuit breaker owns retry timing, so don't also retry here.
                    reconnectStrategy: false,
                },
                username: parsed.username || undefined,
                password: parsed.password || undefined,
                // don't queue commands while offline to avoid request buildup
                disableOfflineQueue: true,
            })

            activeClient = client
            client.on('error', (error) => tripCircuit('client error', error))

            redisClientPromise = client.connect()
                .then(() => {
                    failureLogged = false
                    return client as RedisClient
                })
                .catch((error) => {
                    tripCircuit('connect failed', error)
                    return null
                })
        } catch (error) {
            tripCircuit('invalid REDIS_URL', error)
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
