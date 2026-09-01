import Redis from "ioredis"
import { logger } from "../utils/logger"

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379"

logger.info(`[REDIS] Initializing Redis client. URL: ${redisUrl}`)

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for compatibility with BullMQ
  reconnectOnError: (err) => {
    logger.warn(`[REDIS] Reconnect on error: ${err.message}`)
    return true
  },
})

redis.on("connect", () => {
  logger.info("[REDIS] Connected to Redis server successfully.")
})

redis.on("error", (err) => {
  logger.error("[REDIS] Redis client error:", err)
})

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const response = await redis.ping()
    return response === "PONG"
  } catch (error) {
    logger.error("[REDIS] Redis health check failed:", error)
    return false
  }
}
