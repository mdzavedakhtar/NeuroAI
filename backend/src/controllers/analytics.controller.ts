import { Request, Response } from "express"
import User from "../models/User"
import Knowledge from "../models/Knowledge"
import Message from "../models/Message"
import Feedback from "../models/Feedback"
import UserUsage from "../models/UserUsage"
import RequestLog from "../models/RequestLog"

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics — System-wide analytics from real stored data only.
// No hardcoded values. Missing data produces zeros / empty arrays.
// ─────────────────────────────────────────────────────────────────────────────

export const getSystemAnalytics = async (_req: Request, res: Response): Promise<void> => {
  try {
    // ── Core counts ──────────────────────────────────────────────────────────
    const totalUsers = await User.countDocuments()
    const totalDocuments = await Knowledge.countDocuments()
    const totalQueries = await Message.countDocuments({ role: "user" })

    // Active users: updated in last 30 days
    const activeUsers = await User.countDocuments({
      updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    })

    // ── Document status breakdown ─────────────────────────────────────────────
    const docGroups = await Knowledge.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    const documentStatus = { uploaded: 0, processing: 0, ready: 0, failed: 0 }
    docGroups.forEach((g) => {
      const status = g._id as keyof typeof documentStatus
      if (status in documentStatus) {
        documentStatus[status] = g.count
      } else if (["parsing", "chunking", "vector_indexing", "graph_indexing"].includes(g._id)) {
        documentStatus.processing += g.count
      }
    })

    // ── Token usage ───────────────────────────────────────────────────────────
    const tokenAggregate = await UserUsage.aggregate([
      { $group: { _id: null, totalTokens: { $sum: "$tokensCount" } } },
    ])
    const totalTokens = tokenAggregate[0]?.totalTokens ?? 0

    // ── Feedback scores ───────────────────────────────────────────────────────
    const feedbackGroups = await Feedback.aggregate([
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ])
    const feedbackStats = { helpful: 0, not_helpful: 0 }
    feedbackGroups.forEach((g) => {
      const rating = g._id as keyof typeof feedbackStats
      if (rating in feedbackStats) feedbackStats[rating] = g.count
    })

    // ── Real latency stats from RequestLog ────────────────────────────────────
    // Only populated when the system has processed actual requests.
    const latencyAggregate = await RequestLog.aggregate([
      {
        $group: {
          _id: null,
          avgDurationMs: { $avg: "$durationMs" },
          p95DurationMs: {
            $percentile: { input: "$durationMs", p: [0.95], method: "approximate" },
          },
        },
      },
    ])

    // Percentile returns an array per spec; extract scalar
    let latencyStats: { averageResponseTimeMs: number; p95LatencyMs: number } | null = null
    if (latencyAggregate.length > 0) {
      const row = latencyAggregate[0]
      latencyStats = {
        averageResponseTimeMs: Math.round(row.avgDurationMs ?? 0),
        p95LatencyMs: Math.round(row.p95DurationMs?.[0] ?? 0),
      }
    }

    // ── Real model usage from RequestLog ──────────────────────────────────────
    const modelUsageRaw = await RequestLog.aggregate([
      { $group: { _id: "$modelName", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])
    const modelUsage = modelUsageRaw.map((g) => ({ name: g._id as string, count: g.count as number }))

    // ── Most searched topics ───────────────────────────────────────────────────
    const recentQueries = await Message.find({ role: "user" })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("content")
      .lean()

    const topicsMap = new Map<string, number>()
    const stopWords = new Set([
      "what", "is", "how", "the", "a", "an", "and", "or", "to", "in", "on",
      "for", "with", "this", "that", "of", "about", "your",
    ])

    recentQueries.forEach((q) => {
      q.content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .forEach((word) => {
          if (word.length > 3 && !stopWords.has(word)) {
            topicsMap.set(word, (topicsMap.get(word) ?? 0) + 1)
          }
        })
    })

    const mostSearchedTopics = Array.from(topicsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
    // No fallback injection — an empty array is the correct answer for a fresh system.

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalDocuments,
        totalQueries,
        activeUsers,
        documentStatus,
        totalTokens,
        feedbackStats,
        // latencyStats is null when no RequestLog rows exist (never fabricated)
        latencyStats,
        // modelUsage is [] when no RequestLog rows exist (never fabricated)
        modelUsage,
        mostSearchedTopics,
      },
    })
  } catch (error) {
    console.error("Get system analytics error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to compile system analytics",
    })
  }
}
