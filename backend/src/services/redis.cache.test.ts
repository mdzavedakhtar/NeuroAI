import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
  redisKeys: vi.fn(),
}))

vi.mock("./redis.service", () => ({
  redis: {
    get: (...args: any[]) => mocks.redisGet(...args),
    set: (...args: any[]) => mocks.redisSet(...args),
    del: (...args: any[]) => mocks.redisDel(...args),
    keys: (...args: any[]) => mocks.redisKeys(...args),
  },
}))

import { getCache, setCache, invalidateCache, invalidateCacheByPattern } from "./redis.cache.service"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("redis cache service", () => {
  it("getCache returns parsed object when found", async () => {
    mocks.redisGet.mockResolvedValue(JSON.stringify({ a: 1 }))
    const result = await getCache<{ a: number }>("key")
    expect(result).toEqual({ a: 1 })
    expect(mocks.redisGet).toHaveBeenCalledWith("key")
  })

  it("getCache returns null when not found", async () => {
    mocks.redisGet.mockResolvedValue(null)
    const result = await getCache("key")
    expect(result).toBeNull()
  })

  it("setCache sets stringified object with TTL", async () => {
    mocks.redisSet.mockResolvedValue("OK")
    const result = await setCache("key", { b: 2 }, 60)
    expect(result).toBe(true)
    expect(mocks.redisSet).toHaveBeenCalledWith("key", JSON.stringify({ b: 2 }), "EX", 60)
  })

  it("invalidateCache deletes key", async () => {
    mocks.redisDel.mockResolvedValue(1)
    const result = await invalidateCache("key")
    expect(result).toBe(true)
    expect(mocks.redisDel).toHaveBeenCalledWith("key")
  })

  it("invalidateCacheByPattern deletes matched keys", async () => {
    mocks.redisKeys.mockResolvedValue(["k1", "k2"])
    mocks.redisDel.mockResolvedValue(2)
    const result = await invalidateCacheByPattern("k*")
    expect(result).toBe(true)
    expect(mocks.redisKeys).toHaveBeenCalledWith("k*")
    expect(mocks.redisDel).toHaveBeenCalledWith("k1", "k2")
  })
})
