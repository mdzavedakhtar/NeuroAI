import { describe, expect, it, vi, beforeEach } from "vitest"
import express from "express"
import request from "supertest"

const mocks = vi.hoisted(() => ({
  validateApiKey: vi.fn(),
  checkLimits: vi.fn(),
  trackRequest: vi.fn(),
  trackGeneration: vi.fn(),
  generateRagAnswer: vi.fn(),
}))

vi.mock("../services/apikey.service", () => ({
  validateApiKey: async (key: string) => mocks.validateApiKey(key),
}))

vi.mock("../services/usage.service", () => ({
  checkLimits: async (userId: string, metric: string) => mocks.checkLimits(userId, metric),
  trackRequest: async (userId: string, tokens: number) => mocks.trackRequest(userId, tokens),
  trackGeneration: async (userId: string) => mocks.trackGeneration(userId),
}))

vi.mock("../services/gemini.service", () => ({
  generateRagAnswer: async () => mocks.generateRagAnswer(),
}))

// Mock prompt service to bypass DB hits during tests
vi.mock("../services/prompt.service", () => ({
  getActivePrompt: async () => "mock-prompt",
  renderPrompt: () => "rendered-prompt",
}))

// Mock memory service to bypass DB hits
vi.mock("../services/memory.service", () => ({
  buildMemoryContext: async () => ({ conversationHistory: "none" }),
}))

// Mock models so Mongoose doesn't try to query MongoDB during server setup/middleware
vi.mock("../models/Conversation", () => ({
  default: {
    findOne: async () => ({ _id: "conv-1", userId: "user-1", save: vi.fn() }),
    create: async () => ({ _id: "conv-1", userId: "user-1", save: vi.fn() }),
  },
}))

vi.mock("../models/Message", () => ({
  default: {
    create: async () => ({}),
  },
}))

import { protect } from "../middleware/auth.middleware"
import v1Routes from "./v1.routes"

const app = express()
app.use(express.json())
app.use("/api/v1", v1Routes)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("V1 Public REST APIs & Auth", () => {
  it("rejects request without X-API-Key or Authorization Bearer header with 401", async () => {
    const res = await request(app).post("/api/v1/chat").send({ message: "Hello" })
    expect(res.status).toBe(401)
  })

  it("rejects invalid key with 401", async () => {
    mocks.validateApiKey.mockResolvedValue(null)

    const res = await request(app)
      .post("/api/v1/chat")
      .set("X-API-Key", "ns_invalidkey")
      .send({ message: "Hello" })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Invalid API key")
  })

  it("authenticates and completes chat generation with valid API Key", async () => {
    mocks.validateApiKey.mockResolvedValue({
      user: {
        _id: "user-1",
        name: "Dev User",
        email: "dev@user.com",
        isActive: true,
        plan: "free",
      },
    })
    mocks.checkLimits.mockResolvedValue({ allowed: true })
    mocks.generateRagAnswer.mockResolvedValue("This is the response from AI.")

    const res = await request(app)
      .post("/api/v1/chat")
      .set("X-API-Key", "ns_validkey123")
      .send({ message: "Hello AI" })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.answer).toBe("This is the response from AI.")
    expect(mocks.trackGeneration).toHaveBeenCalledWith("user-1")
    expect(mocks.trackRequest).toHaveBeenCalledWith("user-1", expect.any(Number))
  })
})
