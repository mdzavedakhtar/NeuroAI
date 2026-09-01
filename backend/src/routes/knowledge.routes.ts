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

      // Add to BullMQ queue
      await ingestionQueue.add(`ingest-${knowledgeId}`, { knowledgeId, userId })

      res.status(202).json({
        success: true,
        message: "Document indexing job queued successfully.",
        knowledgeId,
        status: "uploaded",
        currentStep: "queued",
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