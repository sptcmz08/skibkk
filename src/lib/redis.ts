import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as {
    redis: Redis | undefined
}

const getRedisClient = () => {
    if (!globalForRedis.redis) {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
        globalForRedis.redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000)
                return delay
            },
        })

        globalForRedis.redis.on('error', (err) => {
            console.error('Redis connection error:', err)
        })
    }
    return globalForRedis.redis
}

export const redis = getRedisClient()

// Slot locking functions
const LOCK_TTL = 20 * 60 // 20 minutes in seconds

export async function lockSlot(
    courtId: string,
    date: string,
    startTime: string,
    userId: string
): Promise<boolean> {
    const key = `lock:${courtId}:${date}:${startTime}`
    const result = await redis.set(key, userId, 'EX', LOCK_TTL, 'NX')
    return result === 'OK'
}

export async function unlockSlot(
    courtId: string,
    date: string,
    startTime: string
): Promise<void> {
    const key = `lock:${courtId}:${date}:${startTime}`
    await redis.del(key)
}

export async function getSlotLock(
    courtId: string,
    date: string,
    startTime: string
): Promise<string | null> {
    const key = `lock:${courtId}:${date}:${startTime}`
    return redis.get(key)
}

export async function getLockTTL(
    courtId: string,
    date: string,
    startTime: string
): Promise<number> {
    const key = `lock:${courtId}:${date}:${startTime}`
    return redis.ttl(key)
}

export async function getUserLocks(userId: string): Promise<string[]> {
    const keys = await redis.keys('lock:*')
    const userLocks: string[] = []
    for (const key of keys) {
        const value = await redis.get(key)
        if (value === userId) {
            userLocks.push(key)
        }
    }
    return userLocks
}

export async function clearUserLocks(userId: string): Promise<void> {
    const locks = await getUserLocks(userId)
    if (locks.length > 0) {
        await redis.del(...locks)
    }
}
