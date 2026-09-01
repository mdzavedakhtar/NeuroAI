import { describe, expect, it, vi, beforeEach } from "vitest"
import express from "express"
import request from "supertest"

const mocks = vi.hoisted(() => ({
  countDocuments: vi.fn(),
  aggregate: vi.fn(),
  find: vi.fn(),
}))

vi.mock("../models/User", () => ({
  default: {
    countDocuments: () => mocks.countDocuments(),
  },
}))

vi.mock("../models/Knowledge", () => ({
  default: {
    countDocuments: () => mocks.countDocuments(),
    aggregate: () => mocks.aggregate(),
  },
}))

vi.mock("../models/Message", () => ({
  default: {
    countDocuments: () => mocks.countDocuments(),
    find: () => ({
      sort: () => ({
        limit: () => ({
          select: () => ({
            lean: async () => mocks.find(),
          }),
        }),
      }),
    }),
  },
}))

vi.mock("../models/Feedback", () => ({
  default: {
    aggregate: () => mocks.aggregate(),
  },
}))

vi.mock("../models/UserUsage", () => ({
  default: {
    aggregate: () => mocks.aggregate(),
  },
}))

vi.mock("../models/RequestLog", () => ({
  default: {
    aggregate: () => mocks.aggregate(),
  },
}))

import { getSystemAnalytics } from "./analytics.controller"

const app = express()
app.use(express.json())
app.get("/api/analytics", getSystemAnalytics)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Analytics Controller Correctness", () => {
  it("compiles real database metrics without faked data", async () => {
    // Total users, documents, queries, active users
    mocks.countDocuments.mockResolvedValue(10)
    
    // docGroups status, totalTokens, feedbackStats, latencyStats, modelUsage
    // We mock sequential calls to aggregate:
    mocks.aggregate
      .mockResolvedValueOnce([{ _id: "ready", count: 5 }]) // doc status group
      .mockResolvedValueOnce([{ totalTokens: 1500 }])       // totalTokens sum
      .mockResolvedValueOnce([{ _id: "helpful", count: 8 }]) // feedback score
      .mockResolvedValueOnce([{ avgDurationMs: 350, p95DurationMs: [800] }]) // latency stats
      .mockResolvedValueOnce([{ _id: "gemini-2.0-flash", count: 12 }])       // model usage

    // recentQueries
    mocks.find.mockResolvedValue([
      { content: "graph graph graph" },
      { content: "how does graph work?" }
    ])

    const res = await request(app).get("/api/analytics")

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const stats = res.body.stats
    expect(stats.totalUsers).toBe(10)
    expect(stats.documentStatus.ready).toBe(5)
    expect(stats.totalTokens).toBe(1500)
    expect(stats.feedbackStats.helpful).toBe(8)
    
    // latency metrics must reflect database averages
    expect(stats.latencyStats.averageResponseTimeMs).toBe(350)
    expect(stats.latencyStats.p95LatencyMs).toBe(800)

    // model usage
    expect(stats.modelUsage[0].name).toBe("gemini-2.0-flash")
    expect(stats.modelUsage[0].count).toBe(12)

    // searched topics
    expect(stats.mostSearchedTopics[0].name).toBe("graph")
  })
})
