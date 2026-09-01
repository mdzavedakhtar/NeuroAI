import { redis } from "./redis.service"
import { logger } from "../utils/logger"

const DEFAULT_TTL = 300 // 5 minutes in seconds

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key)
    if (!data) return null
    return JSON.parse(data) as T
  } catch (error) {
    logger.error(`[CACHE] Error fetching key "${key}" from Redis:`, error)
    return null
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL
): Promise<boolean> {
  try {
    const data = JSON.stringify(value)
    await redis.set(key, data, "EX", ttlSeconds)
    return true
  } catch (error) {
    logger.error(`[CACHE] Error setting key "${key}" in Redis:`, error)
    return false
  }
}

export async function invalidateCache(key: string): Promise<boolean> {
  try {
    await redis.del(key)
    return true
  } catch (error) {
    logger.error(`[CACHE] Error invalidating key "${key}":`, error)
    return false
  }
}

export async function invalidateCacheByPattern(pattern: string): Promise<boolean> {
  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    return true
  } catch (error) {
    logger.error(`[CACHE] Error invalidating pattern "${pattern}":`, error)
    return false
  }
}
