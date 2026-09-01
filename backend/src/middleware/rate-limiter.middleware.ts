import { NextFunction, Response } from "express"
import { redis } from "../services/redis.service"
import { AuthRequest } from "./auth.middleware"
import { logger } from "../utils/logger"

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_SIZE_SECONDS = 60
const DEFAULT_LIMIT = Number(process.env.RATE_LIMIT_DEFAULT_LIMIT) || 100
const AUTH_LIMIT    = Number(process.env.RATE_LIMIT_AUTH_LIMIT)    || 15

// ─────────────────────────────────────────────────────────────────────────────
// Helper — Redis sliding-window increment
// ─────────────────────────────────────────────────────────────────────────────

async function redisIncr(key: string, windowSeconds: number): Promise<number | null> {
  // Race against a 200ms timeout.
  // ioredis with maxRetriesPerRequest:null (needed for BullMQ) retries forever,
  // so without this timeout a Redis outage would hang EVERY incoming request.
  const redisOp = redis
    .multi()
    .incr(key)
    .expire(key, windowSeconds)
    .exec()

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 200)
  )

  const results = await Promise.race([redisOp, timeout])

  if (!results || !results[0] || results[0][0]) return null
  return results[0][1] as number
}

function setRateLimitHeaders(
  res: Response,
  limit: number,
  count: number,
  windowTimestamp: number
): void {
  const remaining = Math.max(0, limit - count)
  const resetTime  = (windowTimestamp + 1) * WINDOW_SIZE_SECONDS
  res.setHeader("X-RateLimit-Limit",     limit)
  res.setHeader("X-RateLimit-Remaining", remaining)
  res.setHeader("X-RateLimit-Reset",     resetTime)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 1 — IP-based rate limiter (pre-auth)
//
// Intentionally uses req.ip as the identifier because this middleware runs
// BEFORE the protect() auth middleware and req.user is always undefined here.
// This provides coarse DoS protection for all /api traffic.
//
// Auth routes get a tighter limit (AUTH_LIMIT) to slow brute-force attempts.
// ─────────────────────────────────────────────────────────────────────────────

export const ipRateLimiter = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // req.path is relative to the mount point (/api), so auth routes appear as /auth/...
    const isAuthPath = req.path.startsWith("/auth/") || req.path.startsWith("/api/auth/")
    const limit      = isAuthPath ? AUTH_LIMIT : DEFAULT_LIMIT

    const identifier         = req.ip || "unknown"
    const windowTimestamp    = Math.floor(Date.now() / (WINDOW_SIZE_SECONDS * 1000))
    const namespace          = isAuthPath ? "auth" : "default"
    const key                = `rate:ip:${namespace}:${identifier}:${windowTimestamp}`

    const count = await redisIncr(key, WINDOW_SIZE_SECONDS)
    if (count === null) throw new Error("Redis transaction failed during rate limiting")

    setRateLimitHeaders(res, limit, count, windowTimestamp)

    if (count > limit) {
      logger.warn(`[RATE_LIMIT] IP ${identifier} exceeded ${namespace} limit on ${req.originalUrl}. Count: ${count}/${limit}`)
      res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      })
      return
    }

    next()
  } catch (error) {
    logger.error("[RATE_LIMIT] IP rate limiting error, letting request pass:", error)
    next()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 2 — User-based rate limiter (post-auth)
//
// Must be used AFTER protect() middleware so that req.user is populated.
// Identifies requests by authenticated user ID rather than IP, so NAT/proxy
// users don't share a bucket. Apply this on any route that should have
// per-user limits beyond what checkRequestLimit (usage.service) already does.
// ─────────────────────────────────────────────────────────────────────────────

export const userRateLimiter = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      // Guard: should not happen after protect(), but fail-safe
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    const limit           = DEFAULT_LIMIT
    const identifier      = req.user.id
    const windowTimestamp = Math.floor(Date.now() / (WINDOW_SIZE_SECONDS * 1000))
    const key             = `rate:user:${identifier}:${windowTimestamp}`

    const count = await redisIncr(key, WINDOW_SIZE_SECONDS)
    if (count === null) throw new Error("Redis transaction failed during rate limiting")

    setRateLimitHeaders(res, limit, count, windowTimestamp)

    if (count > limit) {
      logger.warn(`[RATE_LIMIT] User ${identifier} exceeded user limit on ${req.originalUrl}. Count: ${count}/${limit}`)
      res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      })
      return
    }

    next()
  } catch (error) {
    logger.error("[RATE_LIMIT] User rate limiting error, letting request pass:", error)
    next()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatible alias — keeps existing server.ts import working
// ─────────────────────────────────────────────────────────────────────────────
export const rateLimiter = ipRateLimiter
