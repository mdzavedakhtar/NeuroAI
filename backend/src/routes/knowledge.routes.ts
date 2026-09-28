import { Router } from "express"
import { AuthRequest } from "../middleware/auth.middleware"

import {
  uploadKnowledge,
  getKnowledgeSources,
  deleteKnowledgeSource,
} from "../controllers/knowledge.controller"

import {
  protect,
} from "../middleware/auth.middleware"

import {
  verifyKnowledgeOwnership,
} from "../middleware/ownership.middleware"

import {
  knowledgeUpload,
} from "../middleware/upload.middleware"

import {
  checkDocumentLimits,
} from "../middleware/limits.middleware"

import {
  ingestionQueue,
} from "../services/ingestion.queue"

import { redis } from "../services/redis.service"
import { runIngestionPipeline } from "../services/ingestion.orchestrator"

const router = Router()

// ======================================================
// UPLOAD KNOWLEDGE
// ======================================================

router.post(
  "/upload",
  protect,
  (req, res, next) => {
    knowledgeUpload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        })
      }
      next()
    })
  },
  checkDocumentLimits,
  uploadKnowledge
)

// ======================================================
// GET KNOWLEDGE SOURCES
// ======================================================

router.get(
  "/",
  protect,
  getKnowledgeSources
)

// ======================================================
// GET SPECIFIC KNOWLEDGE DOCUMENT STATUS
// ======================================================

router.get(
  "/:knowledgeId",
  protect,
  verifyKnowledgeOwnership,
  async (req: AuthRequest, res) => {
    try {
      const knowledge = req.knowledge!
      res.status(200).json({
        success: true,
        knowledge: {
          id: knowledge._id,
          originalName: knowledge.originalName,
          mimeType: knowledge.mimeType,
          size: knowledge.size,
          status: knowledge.status,
          currentStep: knowledge.currentStep,
          errorMessage: knowledge.errorMessage,
          chunks: knowledge.chunks,
          createdAt: knowledge.createdAt,
        },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to get document status" })
    }
  }
)

// ======================================================
// DELETE KNOWLEDGE SOURCE
// Ownership verified by verifyKnowledgeOwnership middleware.
// ======================================================

router.delete(
  "/:knowledgeId",
  protect,
  verifyKnowledgeOwnership,
  deleteKnowledgeSource
)

// ======================================================
// INDEX KNOWLEDGE DOCUMENT
// Triggers the full orchestrated ingestion pipeline:
//   PARSE → CHUNK → VECTOR_INDEXING → GRAPH_INDEXING → COMPLETED
// Ownership verified by verifyKnowledgeOwnership middleware.
// ======================================================

router.post(
  "/:knowledgeId/index",
  protect,
  verifyKnowledgeOwnership,
  async (req: AuthRequest, res) => {
    try {
      const knowledgeId = req.params.knowledgeId as string
      const userId = req.user!.id
      const knowledge = req.knowledge

      if (!knowledge) {
        res.status(404).json({ success: false, message: "Knowledge document not found" })
        return
      }

      // Prevent concurrent enqueue if already active in last 5 mins
      const processingStates = ["processing", "parsing", "chunking", "vector_indexing", "graph_indexing"]
      if (
        processingStates.includes(knowledge.status) &&
        knowledge.lastAttemptAt &&
        Date.now() - new Date(knowledge.lastAttemptAt).getTime() < 5 * 60 * 1000
      ) {
        res.status(400).json({
          success: false,
          message: "Ingestion is already in progress for this document. Please wait.",
        })
        return
      }

      // Update state to queued
      knowledge.status = "uploaded"
      knowledge.currentStep = "queued"
      knowledge.errorMessage = ""
      knowledge.lastAttemptAt = new Date()
      await knowledge.save()

      // Enqueue to BullMQ if Redis is running
      try {
        if (redis.status === "ready") {
          await ingestionQueue.add(`ingest-${knowledgeId}`, { knowledgeId, userId })
        }
      } catch (queueErr: any) {
        console.warn("[KNOWLEDGE] Queue enqueue warning:", queueErr?.message || queueErr)
      }

      // Direct in-process execution fallback so processing NEVER hangs if worker process is inactive
      runIngestionPipeline(knowledgeId, userId).catch((err) => {
        console.error(`[KNOWLEDGE] Ingestion pipeline execution error for ${knowledgeId}:`, err)
      })

      res.status(202).json({
        success: true,
        message: "Document indexing job started successfully.",
        knowledgeId,
        status: "processing",
        currentStep: "parsing",
      })
    } catch (error) {
      console.error("Knowledge enqueue error:", error)
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Knowledge enqueue failed",
      })
    }
  }
)

export default router