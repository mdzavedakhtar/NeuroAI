import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findOne: vi.fn(),
  deleteOne: vi.fn(),
  updateOne: vi.fn(),
}))

vi.mock("../models/ApiKey", () => ({
  default: {
    create: async (...args: any[]) => mocks.create(...args),
    findOne: (...args: any[]) => ({
      populate: async () => mocks.findOne(...args),
    }),
    deleteOne: async (...args: any[]) => mocks.deleteOne(...args),
    updateOne: async (...args: any[]) => mocks.updateOne(...args),
  },
}))

import { generateApiKey, validateApiKey, revokeApiKey, rotateApiKey } from "./apikey.service"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("API Key Service", () => {
  it("generates key with prefix, masked layout, and returns raw key", async () => {
    mocks.create.mockResolvedValue({
      _id: "key-1",
      name: "Test Key",
      keyMasked: "ns_...1234",
      permissions: ["read"],
    })

    const { apiKeyRecord, rawKey } = await generateApiKey("user-1", "Test Key", ["read"])

    expect(rawKey).toContain("ns_")
    expect(apiKeyRecord._id).toBe("key-1")
    expect(mocks.create).toHaveBeenCalled()
  })

  it("validates key matching stored hash", async () => {
    mocks.findOne.mockResolvedValue({
      _id: "key-1",
      user: { _id: "user-1", isActive: true },
    })

    const record = await validateApiKey("ns_abcdef1234567890")
    expect(record).toBeDefined()
    expect(record?.user._id).toBe("user-1")
  })

  it("revokes key successfully", async () => {
    mocks.deleteOne.mockResolvedValue({ deletedCount: 1 })
    const success = await revokeApiKey("key-1", "user-1")
    expect(success).toBe(true)
  })
})
