import { describe, expect, it, vi, beforeEach } from "vitest"
import type { Response, NextFunction } from "express"
import type { AuthRequest } from "../middleware/auth.middleware"

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  knowledgeFindById: vi.fn(),
}))

vi.mock("../models/Knowledge", () => ({
  default: {
    findById: (...args: unknown[]) => mocks.knowledgeFindById(...args),
  },
}))

// Import AFTER mocks are wired up
import { verifyKnowledgeOwnership } from "../middleware/ownership.middleware"

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    params: {},
    body: {},
    query: {},
    user: { id: "user-a", name: "A", email: "a@test.com", role: "user", isEmailVerified: true },
    ...overrides,
  } as unknown as AuthRequest
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
  return res as typeof res & Response
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe("verifyKnowledgeOwnership", () => {
  it("calls next() when no knowledgeId is present in params/body/query", async () => {
    const req = makeReq()
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await verifyKnowledgeOwnership(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(0)
  })

  it("returns 401 when user is not authenticated", async () => {
    const req = makeReq({ user: undefined, params: { knowledgeId: "64a1b2c3d4e5f6789abcdef0" } })
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await verifyKnowledgeOwnership(req, res, next)

    expect(res.statusCode).toBe(401)
    expect((res.body as { success: boolean }).success).toBe(false)
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid MongoDB ObjectId format", async () => {
    const req = makeReq({ params: { knowledgeId: "not-a-valid-id" } })
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await verifyKnowledgeOwnership(req, res, next)

    expect(res.statusCode).toBe(400)
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 404 when knowledge document does not exist", async () => {
    mocks.knowledgeFindById.mockResolvedValue(null)

    const req = makeReq({ params: { knowledgeId: "64a1b2c3d4e5f6789abcdef0" } })
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await verifyKnowledgeOwnership(req, res, next)

    expect(res.statusCode).toBe(404)
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 403 when knowledge belongs to a different user", async () => {
    mocks.knowledgeFindById.mockResolvedValue({
      _id: "64a1b2c3d4e5f6789abcdef0",
      user: { toString: () => "user-b" },  // different owner
    })

    const req = makeReq({ params: { knowledgeId: "64a1b2c3d4e5f6789abcdef0" } })
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await verifyKnowledgeOwnership(req, res, next)

    expect(res.statusCode).toBe(403)
    const body = res.body as { success: boolean; message: string }
    expect(body.success).toBe(false)
    expect(body.message).toContain("Forbidden")
    expect(next).not.toHaveBeenCalled()
  })

  it("attaches knowledge to req and calls next() for the correct owner", async () => {
    const knowledge = {
      _id: "64a1b2c3d4e5f6789abcdef0",
      user: { toString: () => "user-a" },
    }
    mocks.knowledgeFindById.mockResolvedValue(knowledge)

    const req = makeReq({ params: { knowledgeId: "64a1b2c3d4e5f6789abcdef0" } })
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await verifyKnowledgeOwnership(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.knowledge).toBe(knowledge)
    expect(res.statusCode).toBe(0)
  })

  it("picks knowledgeId from req.body when not in req.params", async () => {
    const knowledge = {
      _id: "64a1b2c3d4e5f6789abcdef0",
      user: { toString: () => "user-a" },
    }
    mocks.knowledgeFindById.mockResolvedValue(knowledge)

    const req = makeReq({ body: { knowledgeId: "64a1b2c3d4e5f6789abcdef0" } })
    const res = makeRes()
    const next = vi.fn() as NextFunction

    await verifyKnowledgeOwnership(req, res, next)

    expect(next).toHaveBeenCalledOnce()
  })
})
