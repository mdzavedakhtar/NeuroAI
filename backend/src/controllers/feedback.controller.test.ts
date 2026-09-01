import { describe, expect, it, vi, beforeEach } from "vitest"
import type { Response } from "express"
import type { AuthRequest } from "../middleware/auth.middleware"

const mocks = vi.hoisted(() => ({
  feedbackFindOneAndUpdate: vi.fn(),
  feedbackFindOne: vi.fn(),
  messageFindOne: vi.fn(),
}))

vi.mock("../models/Feedback", () => ({
  default: {
    findOneAndUpdate: async (...args: any[]) => mocks.feedbackFindOneAndUpdate(...args),
    findOne: (...args: any[]) => ({
      lean: async () => mocks.feedbackFindOne(...args),
    }),
  },
}))

// Controller calls Message.findOne({ ... }) with no chaining — direct async call
vi.mock("../models/Message", () => ({
  default: {
    findOne: async (...args: any[]) => mocks.messageFindOne(...args),
  },
}))

import { submitFeedback, getMessageFeedback } from "./feedback.controller"

function makeReq(body: any = {}, params: any = {}): AuthRequest {
  return { body, params, user: { id: "64a1b2c3d4e5f6789abcdef9" } } as unknown as AuthRequest
}

type MockRes = { statusCode: number; body: any; status(c: number): MockRes; json(p: any): MockRes }
function makeRes(): MockRes {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this },
    json(p) { this.body = p; return this },
  }
}

beforeEach(() => vi.clearAllMocks())

describe("feedback controller", () => {
  it("rejects invalid rating values with 400", async () => {
    const req = makeReq({
      conversationId: "64a1b2c3d4e5f6789abcdef0",
      messageId: "64a1b2c3d4e5f6789abcdef1",
      rating: "super_helpful",
    })
    const res = makeRes()
    await submitFeedback(req, res as any)
    expect(res.statusCode).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it("returns 404 when message is not found", async () => {
    mocks.messageFindOne.mockResolvedValue(null)
    const req = makeReq({
      conversationId: "64a1b2c3d4e5f6789abcdef0",
      messageId: "64a1b2c3d4e5f6789abcdef1",
      rating: "helpful",
    })
    const res = makeRes()
    await submitFeedback(req, res as any)
    expect(res.statusCode).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it("stores feedback successfully with valid input", async () => {
    mocks.messageFindOne.mockResolvedValue({ _id: "64a1b2c3d4e5f6789abcdef1" })
    mocks.feedbackFindOneAndUpdate.mockResolvedValue({
      userId: "64a1b2c3d4e5f6789abcdef9",
      messageId: "64a1b2c3d4e5f6789abcdef1",
      rating: "helpful",
    })
    const req = makeReq({
      conversationId: "64a1b2c3d4e5f6789abcdef0",
      messageId: "64a1b2c3d4e5f6789abcdef1",
      rating: "helpful",
      reason: "clear and accurate",
    })
    const res = makeRes()
    await submitFeedback(req, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toBe("Feedback submitted successfully")
  })
})
