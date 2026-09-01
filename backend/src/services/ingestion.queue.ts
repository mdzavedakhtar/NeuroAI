import { Queue } from "bullmq"
import { redis } from "./redis.service"
import { logger } from "../utils/logger"

const QUEUE_NAME = "document-ingestion"

// ─────────────────────────────────────────────────────────────────────────────
// Queue definition only.
// The Worker that consumes jobs lives in src/workers/ingestion.worker.ts and
// runs as a SEPARATE PROCESS so it does not share CPU/memory with the web server.
// ─────────────────────────────────────────────────────────────────────────────

export const ingestionQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
})

ingestionQueue.on("error", (err) => {
  logger.error("[QUEUE] Ingestion queue error:", err.message)
})

export async function closeIngestionQueue(): Promise<void> {
  await ingestionQueue.close()
  logger.info("[QUEUE] Ingestion queue closed.")
}

