import { describe, expect, it, vi, beforeEach } from "vitest"
import mongoose from "mongoose"

const mocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
  aggregate: vi.fn(),
}))

vi.mock("../models/UserUsage", () => ({
  default: {
    findOneAndUpdate: (...args: any[]) => mocks.findOneAndUpdate(...args),
    findOne: (...args: any[]) => mocks.findOne(...args),
  },
}))

vi.mock("../models/User", () => ({
  default: {
    findById: async () => ({ plan: "pro" }),
  },
}))

vi.mock("../models/Knowledge", () => ({
  default: {
    countDocuments: (...args: any[]) => mocks.countDocuments(...args),
    aggregate: (...args: any[]) => mocks.aggregate(...args),
  },
}))

import { trackRequest, trackGeneration, checkLimits } from "./usage.service"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Usage Service Concurrency & Limits", () => {
  it("trackRequest calls findOneAndUpdate atomically with $inc", async () => {
    mocks.findOneAndUpdate.mockResolvedValue({})

    const validUserId = "64a1b2c3d4e5f6789abcdef0"
    await trackRequest(validUserId, 100)

    expect(mocks.findOneAndUpdate).toHaveBeenCalledOnce()
    const args = mocks.findOneAndUpdate.mock.calls[0]
    expect(args[0]).toEqual({ user: new mongoose.Types.ObjectId(validUserId) })
    expect(args[1]).toEqual({
      $inc: { requestsCount: 1, tokensCount: 100 },
    })
    expect(args[2]).toEqual({ upsert: true })
  })

  it("trackGeneration calls findOneAndUpdate atomically with $inc for generation", async () => {
    mocks.findOneAndUpdate.mockResolvedValue({})

    const validUserId = "64a1b2c3d4e5f6789abcdef0"
    await trackGeneration(validUserId)

    expect(mocks.findOneAndUpdate).toHaveBeenCalledOnce()
    const args = mocks.findOneAndUpdate.mock.calls[0]
    expect(args[1]).toEqual({
      $inc: { aiGenerationsCount: 1 },
    })
  })

  it("checkLimits returns allowed: true when limits are not reached", async () => {
    mocks.findOne.mockResolvedValue({
      requestsCount: 5,
      aiGenerationsCount: 2,
      tokensCount: 50,
      periodEnd: new Date(Date.now() + 100000),
    })
    mocks.countDocuments.mockResolvedValue(1)
    mocks.aggregate.mockResolvedValue([{ totalSize: 1000 }])

    const validUserId = "64a1b2c3d4e5f6789abcdef0"
    const result = await checkLimits(validUserId, "requests")
    expect(result.allowed).toBe(true)
  })

  it("checkLimits returns allowed: false when requests limit reached", async () => {
    mocks.findOne.mockResolvedValue({
      requestsCount: 100000, // exceeds standard limits
      aiGenerationsCount: 2,
      tokensCount: 50,
      periodEnd: new Date(Date.now() + 100000),
    })
    mocks.countDocuments.mockResolvedValue(1)
    mocks.aggregate.mockResolvedValue([{ totalSize: 1000 }])

    const validUserId = "64a1b2c3d4e5f6789abcdef0"
    const result = await checkLimits(validUserId, "requests")
    expect(result.allowed).toBe(false)
    expect(result.message).toContain("limit")
  })
})
