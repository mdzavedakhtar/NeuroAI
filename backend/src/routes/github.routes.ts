import { Router } from "express"
import { protect, AuthRequest } from "../middleware/auth.middleware"
import { parseGithubUrl, fetchGithubRepoText, saveGithubBundle } from "../services/github.scraper.service"
import { checkLimits } from "../services/usage.service"
import Knowledge from "../models/Knowledge"
import { ingestionQueue } from "../services/ingestion.queue"
import { invalidateCache } from "../services/redis.cache.service"

const router = Router()

router.post("/", protect, async (req: AuthRequest, res) => {
  try {
    const { repoUrl, token } = req.body
    if (!repoUrl || typeof repoUrl !== "string") {
      res.status(400).json({ success: false, message: "A valid GitHub repository URL is required" })
      return
    }

    const userId = req.user!.id

    // 1. Verify user limits before running fetch
    const docCheck = await checkLimits(userId, "documents")
    if (!docCheck.allowed) {
      res.status(403).json({ success: false, message: docCheck.message })
      return
    }

    // Parse repository name
    const { owner, repo } = parseGithubUrl(repoUrl)

    // Check duplicate repos in database
    const duplicate = await Knowledge.findOne({
      user: userId,
      originalName: `github://${owner}/${repo}`,
      status: "ready",
    })
    if (duplicate) {
      res.status(409).json({
        success: false,
        message: "This repository has already been ingested. See document: " + duplicate.fileName,
      })
      return
    }

    // 2. Fetch and Bundle Repository Text
    const bundleText = await fetchGithubRepoText(owner, repo, token)

    // 3. Verify storage limit with bundled text size
    const sizeBytes = Buffer.byteLength(bundleText, "utf-8")
    const storageCheck = await checkLimits(userId, "storage", sizeBytes)
    if (!storageCheck.allowed) {
      res.status(403).json({ success: false, message: storageCheck.message })
      return
    }

    // 4. Save to uploads folder
    const saved = await saveGithubBundle(owner, repo, bundleText)

    // 5. Create Knowledge record
    const knowledge = await Knowledge.create({
      user: userId,
      originalName: `github://${owner}/${repo}`,
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
      message: "GitHub repository files scraped and queued for indexing successfully.",
      knowledge: {
        id: knowledge._id,
        originalName: knowledge.originalName,
        status: knowledge.status,
        createdAt: knowledge.createdAt,
      },
    })
  } catch (error: any) {
    console.error("GitHub Ingestion Error:", error)
    res.status(error.message?.includes("credentials") || error.message?.includes("URL") ? 400 : 500).json({
      success: false,
      message: error.message || "Failed to ingest GitHub repository",
    })
  }
})

export default router
