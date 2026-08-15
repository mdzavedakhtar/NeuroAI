import { Router } from "express"

import {
  uploadKnowledge,
  getKnowledgeSources,
  deleteKnowledgeSource,
} from "../controllers/knowledge.controller"

import {
  protect,
} from "../middleware/auth.middleware"

import {
  knowledgeUpload,
} from "../middleware/upload.middleware"

import {
  indexKnowledgeDocument,
} from "../services/pinecone.service"

const router = Router()

// ======================================================
// UPLOAD KNOWLEDGE
// ======================================================

router.post(
  "/upload",
  protect,
  knowledgeUpload.single("file"),
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
// ======================================================

router.delete(
  "/:knowledgeId",
  protect,
  deleteKnowledgeSource
)

// ======================================================
// INDEX KNOWLEDGE DOCUMENT
// ======================================================

router.post(
  "/:knowledgeId/index",
  protect,
  async (req, res) => {
    try {
      const knowledgeId =
        req.params.knowledgeId as string

      const result =
        await indexKnowledgeDocument(
          knowledgeId
        )

      res.status(200).json(result)
    } catch (error) {
      console.error(
        "Knowledge indexing error:",
        error
      )

      res.status(500).json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Knowledge indexing failed",
      })
    }
  }
)

export default router