import Redis from "ioredis"
import { logger } from "../utils/logger"

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379"

logger.info(`[REDIS] Initializing Redis client. URL: ${redisUrl}`)

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for compatibility with BullMQ
  enableOfflineQueue: false,  // Do not queue commands indefinitely when Redis is offline/disconnected
  connectTimeout: 2000,       // Fast 2s connection timeout
  reconnectOnError: (err) => {
    logger.warn(`[REDIS] Reconnect on error: ${err.message}`)
    return true
  },
})

redis.on("connect", () => {
  logger.info("[REDIS] Connected to Redis server successfully.")
})

redis.on("error", (err) => {
  logger.error("[REDIS] Redis client error:", err.message || err)
})

export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (redis.status !== "ready") return false
    const pingOp = redis.ping()
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 200))
    const response = await Promise.race([pingOp, timeout])
    return response === "PONG"
  } catch (error) {
    logger.warn("[REDIS] Redis health check failed:", (error as Error).message)
    return false
  }
}
