import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  userCreate: vi.fn(),
  userFindOne: vi.fn(),
  userFindById: vi.fn(),
  generateToken: vi.fn(),
  sendVerificationEmail: vi.fn(),
}))

vi.mock("../models/User", () => ({
  default: {
    create: (...args: unknown[]) => mocks.userCreate(...args),
    findOne: (...args: unknown[]) => mocks.userFindOne(...args),
    findById: (...args: unknown[]) => mocks.userFindById(...args),
  },
}))

vi.mock("../utils/generateToken", () => ({
  generateToken: (...args: unknown[]) => mocks.generateToken(...args),
}))

vi.mock("../utils/email", () => ({
  generateVerificationToken: () => "raw-verification-token",
  hashVerificationToken: (token: string) => `hashed:${token}`,
  buildVerificationUrl: (token: string) =>
    `http://localhost:3000/verify-email?token=${token}`,
  sendVerificationEmail: (...args: unknown[]) =>
    mocks.sendVerificationEmail(...args),
}))

import {
  registerUser,
  loginUser,
  updateProfile,
  changePassword,
  verifyEmail,
} from "./auth.controller"
import type { Request, Response } from "express"

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

type MockUser = {
  _id: { toString: () => string }
  name: string
  email: string
  password: string
  role: string
  avatar: string
  authProvider: string
  isEmailVerified: boolean
  emailVerifiedAt?: Date
  isActive: boolean
  lastLoginAt?: Date
  verificationToken?: string
  verificationTokenExpires?: Date
  comparePassword: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
}

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    _id: { toString: () => "user-1" },
    name: "Test User",
    email: "test@example.com",
    password: "hashed-password",
    role: "user",
    avatar: "",
    authProvider: "local",
    isEmailVerified: false,
    isActive: true,
    comparePassword: vi.fn(async (candidate: string) => candidate === "correct-password"),
    save: vi.fn(async function (this: MockUser) {
      return this
    }),
    ...overrides,
  }
}

// Mimics a Mongoose query: supports .select() chaining AND awaiting.
function withSelect(user: unknown) {
  return {
    select: () => user,
    then: (resolve: (value: unknown) => unknown) => resolve(user),
  }
}

type MockResponse = Response & {
  statusCode: number
  body: unknown
}

function mockRes(): MockResponse {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(this: MockResponse, code: number) {
      this.statusCode = code
      return this
    },
    json(this: MockResponse, payload: unknown) {
      this.body = payload
      return this
    },
  } as unknown as MockResponse
}

function mockReq(body: Record<string, unknown> = {}): Request {
  return { body } as unknown as Request
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.generateToken.mockReturnValue("jwt-token")
  mocks.sendVerificationEmail.mockResolvedValue(false)
  delete process.env.REQUIRE_EMAIL_VERIFICATION
})

// ------------------------------------------------------------
// Register
// ------------------------------------------------------------

describe("registerUser", () => {
  it("registers a valid user and returns a dev verification URL", async () => {
    mocks.userFindOne.mockResolvedValue(null)
    mocks.userCreate.mockResolvedValue(makeUser())

    const res = mockRes()
    await registerUser(
      mockReq({ name: "Test User", email: "Test@Example.com ", password: "password123" }),
      res
    )

    expect(res.statusCode).toBe(201)
    const body = res.body as Record<string, unknown>
    expect(body.success).toBe(true)
    expect((body.user as { email: string }).email).toBe("test@example.com")
    expect(body.devVerificationUrl).toContain("/verify-email?token=")
    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" })
    )
  })

  it("rejects missing fields", async () => {
    const res = mockRes()
    await registerUser(mockReq({ name: "", email: "", password: "" }), res)
    expect(res.statusCode).toBe(400)
  })

  it("rejects passwords shorter than 8 characters", async () => {
    const res = mockRes()
    await registerUser(mockReq({ name: "Test", email: "a@b.com", password: "short" }), res)
    expect(res.statusCode).toBe(400)
  })

  it("rejects duplicate emails", async () => {
    mocks.userFindOne.mockResolvedValue(makeUser())
    const res = mockRes()
    await registerUser(mockReq({ name: "Test", email: "a@b.com", password: "password123" }), res)
    expect(res.statusCode).toBe(409)
  })
})

// ------------------------------------------------------------
// Login
// ------------------------------------------------------------

describe("loginUser", () => {
  it("logs in a user with valid credentials", async () => {
    mocks.userFindOne.mockImplementation(() => withSelect(makeUser()))

    const res = mockRes()
    await loginUser(mockReq({ email: "test@example.com", password: "correct-password" }), res)

    expect(res.statusCode).toBe(200)
    const body = res.body as { success: boolean; token: string; user: { isEmailVerified: boolean } }
    expect(body.success).toBe(true)
    expect(body.token).toBe("jwt-token")
    expect(body.user.isEmailVerified).toBe(false)
  })

  it("rejects invalid credentials", async () => {
    mocks.userFindOne.mockImplementation(() => withSelect(makeUser()))
    const res = mockRes()
    await loginUser(mockReq({ email: "test@example.com", password: "wrong-password" }), res)
    expect(res.statusCode).toBe(401)
  })

  it("blocks disabled accounts", async () => {
    mocks.userFindOne.mockImplementation(() => withSelect(makeUser({ isActive: false })))
    const res = mockRes()
    await loginUser(mockReq({ email: "test@example.com", password: "correct-password" }), res)
    expect(res.statusCode).toBe(403)
  })

  it("blocks unverified accounts when REQUIRE_EMAIL_VERIFICATION is on", async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = "true"
    mocks.userFindOne.mockImplementation(() => withSelect(makeUser()))

    const res = mockRes()
    await loginUser(mockReq({ email: "test@example.com", password: "correct-password" }), res)

    expect(res.statusCode).toBe(403)
    expect((res.body as { requiresVerification?: boolean }).requiresVerification).toBe(true)
  })
})

// ------------------------------------------------------------
// Update profile
// ------------------------------------------------------------

describe("updateProfile", () => {
  function authReq(user: unknown, body: Record<string, unknown> = {}) {
    return { user, body } as unknown as Request
  }

  it("updates the user name", async () => {
    const user = makeUser()
    mocks.userFindById.mockResolvedValue(user)

    const res = mockRes()
    await updateProfile(authReq({ id: "user-1" }, { name: "New Name" }), res)

    expect(res.statusCode).toBe(200)
    expect(user.name).toBe("New Name")
    expect(user.save).toHaveBeenCalled()
  })

  it("rejects names shorter than 2 characters", async () => {
    const res = mockRes()
    await updateProfile(authReq({ id: "user-1" }, { name: "A" }), res)
    expect(res.statusCode).toBe(400)
  })

  it("rejects unauthenticated requests", async () => {
    const res = mockRes()
    await updateProfile(mockReq({}), res)
    expect(res.statusCode).toBe(401)
  })
})

// ------------------------------------------------------------
// Change password
// ------------------------------------------------------------

describe("changePassword", () => {
  function authReq(user: unknown, body: Record<string, unknown> = {}) {
    return { user, body } as unknown as Request
  }

  it("changes the password with a correct current password", async () => {
    const user = makeUser()
    mocks.userFindById.mockImplementation(() => withSelect(user))

    const res = mockRes()
    await changePassword(
      authReq({ id: "user-1" }, { currentPassword: "correct-password", newPassword: "new-password-123" }),
      res
    )

    expect(res.statusCode).toBe(200)
    expect(user.password).toBe("new-password-123")
  })

  it("rejects an incorrect current password", async () => {
    const user = makeUser()
    mocks.userFindById.mockImplementation(() => withSelect(user))

    const res = mockRes()
    await changePassword(
      authReq({ id: "user-1" }, { currentPassword: "wrong", newPassword: "new-password-123" }),
      res
    )

    expect(res.statusCode).toBe(401)
  })

  it("rejects new passwords shorter than 8 characters", async () => {
    const res = mockRes()
    await changePassword(
      authReq({ id: "user-1" }, { currentPassword: "correct-password", newPassword: "short" }),
      res
    )
    expect(res.statusCode).toBe(400)
  })
})

// ------------------------------------------------------------
// Verify email
// ------------------------------------------------------------

describe("verifyEmail", () => {
  it("verifies a valid token", async () => {
    const user = makeUser()
    mocks.userFindOne.mockImplementation(() => withSelect(user))

    const res = mockRes()
    await verifyEmail(mockReq({ token: "raw-verification-token" }), res)

    expect(res.statusCode).toBe(200)
    expect(user.isEmailVerified).toBe(true)
    expect(user.emailVerifiedAt).toBeInstanceOf(Date)
    expect(user.save).toHaveBeenCalled()
  })

  it("rejects an unknown token", async () => {
    mocks.userFindOne.mockImplementation(() => withSelect(null))
    const res = mockRes()
    await verifyEmail(mockReq({ token: "unknown" }), res)
    expect(res.statusCode).toBe(400)
  })

  it("rejects an expired token", async () => {
    const user = makeUser({ verificationTokenExpires: new Date(Date.now() - 1000) })
    mocks.userFindOne.mockImplementation(() => withSelect(user))

    const res = mockRes()
    await verifyEmail(mockReq({ token: "raw-verification-token" }), res)

    expect(res.statusCode).toBe(400)
  })

  it("requires a token", async () => {
    const res = mockRes()
    await verifyEmail(mockReq({}), res)
    expect(res.statusCode).toBe(400)
  })
})
