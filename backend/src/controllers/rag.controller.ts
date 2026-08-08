import { Response } from "express"

import { AuthRequest } from "../middleware/auth.middleware"

import {
  searchKnowledge,
  buildKnowledgeContext,
} from "../services/pinecone.service"

import {
  generateRagAnswer,
} from "../services/gemini.service"

export const askKnowledge = async (
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

    const { question, knowledgeId } = req.body

    if (
      typeof question !== "string" ||
      !question.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Question is required",
      })
      return
    }

    if (
      knowledgeId !== undefined &&
      typeof knowledgeId !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid knowledgeId",
      })
      return
    }

    const cleanQuestion = question.trim()

    // ================================================
    // STEP 1 — SEARCH PINECONE
    // ================================================

    const results = await searchKnowledge({
      query: cleanQuestion,
      userId: req.user.id,
      knowledgeId,
      topK: 5,
    })

    // ================================================
    // STEP 2 — NO RESULTS
    // ================================================

    if (results.length === 0) {
      res.status(200).json({
        success: true,
        question: cleanQuestion,
        answer:
          "I could not find relevant information in the uploaded knowledge base.",
        sources: [],
      })
      return
    }

    // ================================================
    // STEP 3 — BUILD RAG CONTEXT
    // ================================================

    const context =
      buildKnowledgeContext(results)

    // ================================================
    // STEP 4 — GEMINI ANSWER
    // ================================================

    const answer =
      await generateRagAnswer({
        question: cleanQuestion,
        context,
      })

    // ================================================
    // STEP 5 — BUILD SOURCES
    // ================================================

    const sources = results.map(
      (result, index) => ({
        sourceNumber: index + 1,

        id: result.id,

        fileName:
          result.originalName,

        chunkIndex:
          result.chunkIndex,

        score:
          result.score,

        knowledgeId:
          result.knowledgeId,
      })
    )

    // ================================================
    // FINAL RESPONSE
    // ================================================

    res.status(200).json({
      success: true,

      question:
        cleanQuestion,

      answer,

      sources,
    })
  } catch (error) {
    console.error(
      "RAG answer error:",
      error
    )

    res.status(500).json({
      success: false,

      message:
        error instanceof Error
          ? error.message
          : "Unable to generate answer",
    })
  }
}