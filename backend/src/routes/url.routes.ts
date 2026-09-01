import { Router } from "express"
import { protect, AuthRequest } from "../middleware/auth.middleware"
import { scrapeUrl, saveScrapedText } from "../services/url.scraper.service"
import { checkLimits } from "../services/usage.service"
import Knowledge from "../models/Knowledge"
import { ingestionQueue } from "../services/ingestion.queue"
import { invalidateCache } from "../services/redis.cache.service"

const router = Router()

router.post("/", protect, async (req: AuthRequest, res) => {
  try {
    const { url } = req.body
    if (!url || typeof url !== "string") {
      res.status(400).json({ success: false, message: "A valid URL is required" })
      return
    }

    const userId = req.user!.id

    // 1. Verify user limits before running fetch
    const docCheck = await checkLimits(userId, "documents")
    if (!docCheck.allowed) {
      res.status(403).json({ success: false, message: docCheck.message })
      return
    }

    // Check duplicate URL downloads in database
    const duplicate = await Knowledge.findOne({ user: userId, originalName: url, status: "ready" })
    if (duplicate) {
      res.status(409).json({
        success: false,
        message: "This URL has already been ingested. See document: " + duplicate.originalName,
      })
      return
    }

    // 2. Scrape Page Content
    const scraped = await scrapeUrl(url)

    // 3. Verify storage limit with scraped text size
    const sizeBytes = Buffer.byteLength(scraped.text, "utf-8")
    const storageCheck = await checkLimits(userId, "storage", sizeBytes)
    if (!storageCheck.allowed) {
      res.status(403).json({ success: false, message: storageCheck.message })
      return
    }

    // 4. Save to uploads folder
    const saved = await saveScrapedText(scraped.title, scraped.text)

    // 5. Create Knowledge record
    const knowledge = await Knowledge.create({
      user: userId,
      originalName: url,
      fileName: saved.filename,
      mimeType: "text/plain",
      size: sizeBytes,
      path: saved.path,
      status: "uploaded",
      currentStep: "uploaded",
    })

    // Invalidate dashboard caches
    await invalidateCache(`cache:user:${userId}:sources`)

    // 6. Queue BullMQ indexing job
    await ingestionQueue.add(`ingest-${knowledge._id}`, {
      knowledgeId: knowledge._id.toString(),
      userId,
    })

    res.status(202).json({
      success: true,
      message: "URL page content scraped and queued for indexing successfully.",
      knowledge: {
        id: knowledge._id,
        originalName: knowledge.originalName,
        status: knowledge.status,
        createdAt: knowledge.createdAt,
      },
    })
  } catch (error: any) {
    console.error("URL Ingestion Error:", error)
    res.status(error.message?.includes("SSRF") || error.message?.includes("timed out") ? 400 : 500).json({
      success: false,
      message: error.message || "Failed to ingest URL",
    })
  }
})

export default router
