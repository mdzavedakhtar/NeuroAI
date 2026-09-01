import { describe, expect, it, vi, beforeEach } from "vitest"
import express from "express"
import request from "supertest"

const mocks = vi.hoisted(() => ({
  checkLimits: vi.fn(),
  trackGeneration: vi.fn(),
  trackRequest: vi.fn(),
  generateRagAnswer: vi.fn(),
  createMessage: vi.fn(),
  findOneConversation: vi.fn(),
}))

vi.mock("../services/usage.service", () => ({
  checkLimits: async (userId: string, metric: string) => mocks.checkLimits(userId, metric),
  trackRequest: async (userId: string, tokens: number) => mocks.trackRequest(userId, tokens),
  trackGeneration: async (userId: string) => mocks.trackGeneration(userId),
}))

vi.mock("../services/gemini.service", () => ({
  generateRagAnswer: async () => mocks.generateRagAnswer(),
}))

vi.mock("../services/memory.service", () => ({
  buildMemoryContext: async () => ({ conversationHistory: "none" }),
}))

vi.mock("../models/Conversation", () => ({
  default: {
    findOne: () => mocks.findOneConversation(),
  },
}))

vi.mock("../models/Message", () => ({
  default: {
    findOne: () => ({
      sort: () => ({
        lean: async () => null,
      }),
    }),
    create: async (...args: any[]) => mocks.createMessage(...args),
  },
}))

vi.mock("../models/RequestLog", () => ({
  default: {
    create: async () => ({}),
  },
}))

import { sendChatMessage } from "./chat.controller"

const app = express()
app.use(express.json())
app.post("/api/chat/:conversationId/messages", (req: any, res, next) => {
  req.user = { id: "64a1b2c3d4e5f6789abcdef0", role: "user", plan: "free" }
  next()
}, sendChatMessage)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Dashboard Chat Usage Tracking", () => {
  it("enforces plan limits check and blocks if exceeded", async () => {
    mocks.checkLimits.mockResolvedValue({ allowed: false, message: "Generation limit reached" })

    const res = await request(app)
      .post("/api/chat/64a1b2c3d4e5f6789abcdef1/messages")
      .send({ message: "Hello AI" })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe("Generation limit reached")
  })

  it("successfully tracking generation and request on message send", async () => {
    mocks.checkLimits.mockResolvedValue({ allowed: true })
    mocks.findOneConversation.mockResolvedValue({
      _id: "64a1b2c3d4e5f6789abcdef1",
      userId: "64a1b2c3d4e5f6789abcdef0",
      title: "New Conversation",
      save: vi.fn(),
    })
    mocks.generateRagAnswer.mockResolvedValue("Hi there!")

    const res = await request(app)
      .post("/api/chat/64a1b2c3d4e5f6789abcdef1/messages")
      .send({ message: "Hello AI" })

    expect(res.status).toBe(200)
    expect(mocks.trackGeneration).toHaveBeenCalledWith("64a1b2c3d4e5f6789abcdef0")
    expect(mocks.trackRequest).toHaveBeenCalledWith("64a1b2c3d4e5f6789abcdef0", expect.any(Number))
  })
})
