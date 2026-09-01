import { describe, expect, it, vi, beforeEach } from "vitest"
import { checkRequestLimit, checkDocumentLimits } from "./limits.middleware"

const mocks = vi.hoisted(() => ({
  checkLimits: vi.fn(),
  trackRequest: vi.fn(),
}))

vi.mock("../services/usage.service", () => ({
  checkLimits: async (...args: any[]) => mocks.checkLimits(...args),
  trackRequest: async (...args: any[]) => mocks.trackRequest(...args),
}))

function makeReq(user: any = {}): any {
  return { user }
}

function makeRes(): any {
  const res: any = {}
  res.statusCode = 200
  res.body = null
  res.status = (code: number) => {
    res.statusCode = code
    return res
  }
  res.json = (data: any) => {
    res.body = data
    return res
  }
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Limits Middleware", () => {
  it("allows request if checkLimits allows it", async () => {
    mocks.checkLimits.mockResolvedValue({ allowed: true })
    mocks.trackRequest.mockResolvedValue({})

    const req = makeReq({ id: "user-1" })
    const res = makeRes()
    const next = vi.fn()

    await checkRequestLimit(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
  })

  it("blocks request with 429 if checkLimits rejects requests count", async () => {
    mocks.checkLimits.mockResolvedValue({ allowed: false, message: "Request limit exceeded" })

    const req = makeReq({ id: "user-1" })
    const res = makeRes()
    const next = vi.fn()

    await checkRequestLimit(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(429)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe("Request limit exceeded")
  })
})
