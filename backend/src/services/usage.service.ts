import mongoose from "mongoose"
import UserUsage from "../models/UserUsage"
import User from "../models/User"
import Knowledge from "../models/Knowledge"
import { getPlanLimits } from "../config/plan.config"

export async function getOrCreateUsage(userId: string) {
  let usage = await UserUsage.findOne({ user: userId })
  if (!usage) {
    usage = await UserUsage.create({
      user: new mongoose.Types.ObjectId(userId),
    })
  }

  // Check if period has ended and needs reset
  if (new Date() > usage.periodEnd) {
    usage.requestsCount = 0
    usage.aiGenerationsCount = 0
    usage.tokensCount = 0
    usage.periodStart = new Date()
    usage.periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await usage.save()
  }

  return usage
}

export async function trackRequest(userId: string, tokens: number = 0): Promise<void> {
  // Atomic increment — safe under concurrent requests.
  // No race condition: $inc is applied server-side regardless of in-flight reads.
  const inc: Record<string, number> = { requestsCount: 1 }
  if (tokens > 0) inc.tokensCount = tokens

  await UserUsage.findOneAndUpdate(
    { user: new mongoose.Types.ObjectId(userId) },
    { $inc: inc },
    { upsert: true }
  )
}

export async function trackGeneration(userId: string): Promise<void> {
  // Atomic increment — safe under concurrent requests.
  await UserUsage.findOneAndUpdate(
    { user: new mongoose.Types.ObjectId(userId) },
    { $inc: { aiGenerationsCount: 1 } },
    { upsert: true }
  )
}


export interface IUsageOverview {
  planName: string
  limits: {
    requestsLimit: number
    aiGenerationsLimit: number
    tokensLimit: number
    documentsLimit: number
    storageLimit: number
  }
  usage: {
    requestsCount: number
    aiGenerationsCount: number
    tokensCount: number
    documentsCount: number
    storageBytes: number
  }
}

export async function getUsageOverview(userId: string): Promise<IUsageOverview> {
  const user = await User.findById(userId)
  const planName = user?.plan || "free"
  const limits = getPlanLimits(planName)

  const usageRecord = await getOrCreateUsage(userId)

  // Calculate document count
  const documentsCount = await Knowledge.countDocuments({ user: userId })

  // Calculate storage size
  const storageAggregate = await Knowledge.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, totalSize: { $sum: "$size" } } },
  ])
  const storageBytes = storageAggregate[0]?.totalSize || 0

  return {
    planName,
    limits: {
      requestsLimit: limits.requestsLimit,
      aiGenerationsLimit: limits.aiGenerationsLimit,
      tokensLimit: limits.tokensLimit,
      documentsLimit: limits.documentsLimit,
      storageLimit: limits.storageLimit,
    },
    usage: {
      requestsCount: usageRecord.requestsCount,
      aiGenerationsCount: usageRecord.aiGenerationsCount,
      tokensCount: usageRecord.tokensCount,
      documentsCount,
      storageBytes,
    },
  }
}

export async function checkLimits(
  userId: string,
  metric: "requests" | "aiGenerations" | "tokens" | "documents" | "storage",
  newDocumentSize: number = 0
): Promise<{ allowed: boolean; message?: string }> {
  const overview = await getUsageOverview(userId)
  const limits = overview.limits
  const usage = overview.usage

  switch (metric) {
    case "requests":
      if (usage.requestsCount >= limits.requestsLimit) {
        return { allowed: false, message: `Request limit of ${limits.requestsLimit} reached for your ${overview.planName} plan.` }
      }
      break
    case "aiGenerations":
      if (usage.aiGenerationsCount >= limits.aiGenerationsLimit) {
        return { allowed: false, message: `AI generation limit of ${limits.aiGenerationsLimit} reached for your ${overview.planName} plan.` }
      }
      break
    case "tokens":
      if (usage.tokensCount >= limits.tokensLimit) {
        return { allowed: false, message: `Token limit of ${limits.tokensLimit} reached for your ${overview.planName} plan.` }
      }
      break
    case "documents":
      if (usage.documentsCount >= limits.documentsLimit) {
        return { allowed: false, message: `Document limit of ${limits.documentsLimit} reached for your ${overview.planName} plan.` }
      }
      break
    case "storage":
      if (usage.storageBytes + newDocumentSize > limits.storageLimit) {
        const currentMB = (usage.storageBytes / (1024 * 1024)).toFixed(2)
        const limitMB = (limits.storageLimit / (1024 * 1024)).toFixed(0)
        return { allowed: false, message: `Storage limit of ${limitMB}MB reached for your ${overview.planName} plan. Current: ${currentMB}MB.` }
      }
      break
  }

  return { allowed: true }
}
