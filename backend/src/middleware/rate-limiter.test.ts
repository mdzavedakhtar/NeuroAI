import { describe, expect, it, vi, beforeEach } from "vitest"
import type { NextFunction } from "express"
import type { AuthRequest } from "./auth.middleware"

const mocks = vi.hoisted(() => ({
  redisExec: vi.fn(),
}))

vi.mock("../services/redis.service", () => ({
  redis: {
    multi: () => ({
      incr: function (_key: string) { return this },
      expire: function (_key: string, _ttl: number) { return this },
      exec: async function () { return mocks.redisExec() },
    }),
  },
}))

import { rateLimiter } from "./rate-limiter.middleware"

type MockRes = {
  statusCode: number
  body: any
  headers: Map<string, any>
  setHeader(name: string, value: any): MockRes
  status(code: number): MockRes
  json(payload: any): MockRes
  getHeader(name: string): any
}

function makeReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    path: "/api/chat",
    ip: "127.0.0.1",
    user: { id: "user-1" },
    originalUrl: "/api/chat",
    ...overrides,
  } as unknown as AuthRequest
}

function makeRes(): MockRes {
  const headers = new Map<string, any>()
  return {
    statusCode: 200,
    body: undefined,
    headers,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); return this },
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
    getHeader(name) { return headers.get(name.toLowerCase()) },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("rate-limiter middleware", () => {
  it("allows requests and sets headers when under limit", async () => {
    mocks.redisExec.mockResolvedValue([[null, 5], [null, 1]])

    const req = makeReq()
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await rateLimiter(req, res as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
    expect(res.getHeader("x-ratelimit-limit")).toBe(100)
    expect(res.getHeader("x-ratelimit-remaining")).toBe(95)
  })

  it("returns 429 when limit is exceeded", async () => {
    mocks.redisExec.mockResolvedValue([[null, 101], [null, 1]])

    const req = makeReq()
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await rateLimiter(req, res as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(429)
    expect(res.body.success).toBe(false)
  })

  it("uses stricter auth limit on login path", async () => {
    mocks.redisExec.mockResolvedValue([[null, 14], [null, 1]])

    const req = makeReq({ path: "/api/auth/login" } as any)
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await rateLimiter(req, res as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.getHeader("x-ratelimit-limit")).toBe(15)
  })

  it("falls through if Redis fails (fail-open)", async () => {
    mocks.redisExec.mockRejectedValue(new Error("Redis down"))

    const req = makeReq()
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await rateLimiter(req, res as any, next)

    // Fail-open: still calls next
    expect(next).toHaveBeenCalledOnce()
  })

  it("falls through within 200ms timeout when Redis hangs (fail-open)", async () => {
    vi.useFakeTimers()

    // Redis never settles — simulates ioredis infinite retry on ECONNREFUSED
    mocks.redisExec.mockReturnValue(new Promise(() => {}))

    const req = makeReq()
    const res = makeRes()
    const next = vi.fn() as NextFunction

    const pending = rateLimiter(req, res as any, next)

    // Advance past the 200ms timeout
    await vi.advanceTimersByTimeAsync(201)
    await pending

    expect(next).toHaveBeenCalledOnce()

    vi.useRealTimers()
  })
})
