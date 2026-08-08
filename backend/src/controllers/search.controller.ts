import { Response } from "express"

import { AuthRequest } from "../middleware/auth.middleware"

import {
  searchKnowledge,
  buildKnowledgeContext,
} from "../services/pinecone.service"


// ======================================================
// SEARCH USER KNOWLEDGE
// ======================================================

export const searchUserKnowledge = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })

      return
    }

    const {
      query,
      knowledgeId,
      topK,
    } = req.body


    // ==================================================
    // VALIDATION
    // ==================================================

    if (
      !query ||
      typeof query !== "string" ||
      !query.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Search query is required",
      })

      return
    }


    let safeTopK = 5

    if (
      typeof topK === "number" &&
      Number.isInteger(topK)
    ) {
      safeTopK = Math.min(
        Math.max(topK, 1),
        20
      )
    }


    // ==================================================
    // SEMANTIC SEARCH
    // ==================================================

    const results =
      await searchKnowledge({
        query: query.trim(),

        userId: req.user.id,

        knowledgeId:
          typeof knowledgeId === "string" &&
          knowledgeId.trim()
            ? knowledgeId.trim()
            : undefined,

        topK: safeTopK,
      })


    // ==================================================
    // RAG CONTEXT
    // ==================================================

    const context =
      buildKnowledgeContext(results)


    // ==================================================
    // RESPONSE
    // ==================================================

    res.status(200).json({
      success: true,

      query: query.trim(),

      count: results.length,

      results,

      context,
    })

  } catch (error) {

    console.error(
      "Knowledge search error:",
      error
    )

    res.status(500).json({
      success: false,

      message:
        error instanceof Error
          ? error.message
          : "Knowledge search failed",
    })
  }
}