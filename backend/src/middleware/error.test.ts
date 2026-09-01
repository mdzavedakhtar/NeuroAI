import { describe, expect, it, vi } from "vitest"
import type { Request, NextFunction } from "express"
import { AppError, errorHandler } from "./error.middleware"

type MockRes = {
  statusCode: number
  body: any
  status(code: number): MockRes
  json(payload: any): MockRes
  getHeader(name: string): string | undefined
}

function makeReq(): Request {
  return {
    method: "GET",
    originalUrl: "/api/test",
  } as unknown as Request
}

function makeRes(): MockRes {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
    getHeader(name) {
      if (name.toLowerCase() === "x-request-id") return "test-request-id"
      return undefined
    },
  }
}

describe("errorHandler middleware", () => {
  it("formats AppError operational errors correctly", () => {
    const req = makeReq()
    const res = makeRes()
    const err = new AppError("Invalid input parameters", 400)
    const next = vi.fn() as NextFunction

    errorHandler(err, req, res as any, next)

    expect(res.statusCode).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe("Invalid input parameters")
    expect(res.body.requestId).toBe("test-request-id")
  })

  it("redacts unexpected internal errors and returns 500 fallback", () => {
    const req = makeReq()
    const res = makeRes()
    const err = new Error("Database uri mongodb://root:secret@host leaked")
    const next = vi.fn() as NextFunction

    errorHandler(err, req, res as any, next)

    expect(res.statusCode).toBe(500)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe("An unexpected error occurred. Please try again.")
    expect(res.body.requestId).toBe("test-request-id")
  })
})
