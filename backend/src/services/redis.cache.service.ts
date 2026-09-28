import { redis } from "./redis.service"
import { logger } from "../utils/logger"

const DEFAULT_TTL = 300 // 5 minutes in seconds

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (redis.status === "end") return null
    const redisOp = redis.get(key)
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 150))
    const data = await Promise.race([redisOp, timeout])
    if (!data) return null
    return JSON.parse(data) as T
  } catch (error) {
    logger.warn(`[CACHE] Error fetching key "${key}" from Redis:`, (error as Error).message)
    return null
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL
): Promise<boolean> {
  try {
    if (redis.status === "end") return false
    const data = JSON.stringify(value)
    const redisOp = redis.set(key, data, "EX", ttlSeconds)
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 150))
    await Promise.race([redisOp, timeout])
    return true
  } catch (error) {
    logger.warn(`[CACHE] Error setting key "${key}" in Redis:`, (error as Error).message)
    return false
  }
}

export async function invalidateCache(key: string): Promise<boolean> {
  try {
    if (redis.status === "end") return false
    const redisOp = redis.del(key)
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 150))
    await Promise.race([redisOp, timeout])
    return true
  } catch (error) {
    logger.warn(`[CACHE] Error invalidating key "${key}":`, (error as Error).message)
    return false
  }
}

export async function invalidateCacheByPattern(pattern: string): Promise<boolean> {
  try {
    if (redis.status === "end") return false
    const redisOp = (async () => {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    })()
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 150))
    await Promise.race([redisOp, timeout])
    return true
  } catch (error) {
    logger.warn(`[CACHE] Error invalidating pattern "${pattern}":`, (error as Error).message)
    return false
  }
}
