/**
 * Ingestion Worker — Dedicated Process Entry Point
 *
 * This file is the SOLE place where the BullMQ Worker is instantiated.
 * It must run as a separate process from the Express web server so that
 * CPU-heavy ingestion jobs (PDF parsing, Gemini extraction, Neo4j writes)
 * do not starve HTTP request handlers.
 *
 * Dev:  npx tsx src/workers/ingestion.worker.ts
 * Prod: node dist/workers/ingestion.worker.js
 */

import "dotenv/config"

import { Worker, Job } from "bullmq"
import Redis from "ioredis"
import mongoose from "mongoose"
import Knowledge from "../models/Knowledge.js"
import { runIngestionPipeline } from "../services/ingestion.orchestrator.js"
import { logger } from "../utils/logger.js"
import { verifyNeo4jConnection, closeNeo4jDriver } from "../config/neo4j.js"

// ─────────────────────────────────────────────────────────────────────────────
// Redis connection (separate from the web server's connection)
// ─────────────────────────────────────────────────────────────────────────────

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379"

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // required for BullMQ workers
})

redis.on("error", (err) => {
  logger.error("[WORKER] Redis error:", err.message)
})

// ─────────────────────────────────────────────────────────────────────────────
// MongoDB connection
// ─────────────────────────────────────────────────────────────────────────────

async function connectDb(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set. Worker cannot start.")
  }
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30000,
  })
  logger.info("[WORKER] MongoDB connected.")
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate required AI configuration
// ─────────────────────────────────────────────────────────────────────────────

function validateConfig(): void {
  const required = [
    "GEMINI_API_KEY",
    "PINECONE_API_KEY",
    "PINECONE_INDEX_NAME",
    "NEO4J_URI",
    "NEO4J_USERNAME",
    "NEO4J_PASSWORD",
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`[WORKER] Missing required environment variables: ${missing.join(", ")}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────────────────────

const QUEUE_NAME = "document-ingestion"

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { knowledgeId, userId } = job.data as { knowledgeId: string; userId: string }
    logger.info(`[WORKER] Processing job ${job.id} for document ${knowledgeId}`)
    await runIngestionPipeline(knowledgeId, userId)
  },
  {
    connection: redis,
    concurrency: 2, // max 2 parallel ingestion pipelines
  }
)

worker.on("completed", (job) => {
  logger.info(`[WORKER] Job ${job.id} (doc: ${job.data.knowledgeId}) completed.`)
})

worker.on("failed", async (job, err) => {
  const errorMsg = err instanceof Error ? err.message : "Unknown worker error"
  logger.error(`[WORKER] Job ${job?.id} failed: ${errorMsg}`)

  if (job?.data?.knowledgeId) {
    try {
      await Knowledge.findByIdAndUpdate(job.data.knowledgeId, {
        status: "failed",
        errorMessage: errorMsg,
      })
    } catch (dbErr) {
      logger.error("[WORKER] Failed to update document failure status:", dbErr)
    }
  }
})

worker.on("error", (err) => {
  logger.error("[WORKER] Worker error:", err.message)
})

// ─────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  logger.info("[WORKER] Shutting down gracefully…")
  await worker.close()
  await redis.quit()
  await closeNeo4jDriver()
  await mongoose.disconnect()
  logger.info("[WORKER] Shutdown complete.")
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateConfig()
  await connectDb()

  try {
    await verifyNeo4jConnection()
    logger.info("[WORKER] Neo4j connected.")
  } catch (err) {
    logger.warn("[WORKER] Neo4j unavailable — graph indexing will fail for new jobs.")
  }

  logger.info("[WORKER] NeuroStack AI Ingestion Worker started. Waiting for jobs…")
}

main().catch((err) => {
  logger.error("[WORKER] Fatal startup error:", err.message)
  process.exit(1)
})
