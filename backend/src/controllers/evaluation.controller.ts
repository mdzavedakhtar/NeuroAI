import { Response } from "express"
import { AuthRequest } from "../middleware/auth.middleware"
import RagEvaluation from "../models/RagEvaluation"
import { evaluateRagResponse } from "../services/rag.evaluator"
import mongoose from "mongoose"
import { logger } from "../utils/logger"

export const getEvaluationStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id)

    // Aggregate statistics
    const stats = await RagEvaluation.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalEvaluations: { $sum: 1 },
          avgContextRelevance: { $avg: "$contextRelevance" },
          avgAnswerRelevance: { $avg: "$answerRelevance" },
          avgFaithfulness: { $avg: "$faithfulness" },
          avgAverageScore: { $avg: "$averageScore" },
        },
      },
    ])

    const summary = stats[0] || {
      totalEvaluations: 0,
      avgContextRelevance: 0,
      avgAnswerRelevance: 0,
      avgFaithfulness: 0,
      avgAverageScore: 0,
    }

    // Get recent evaluations
    const history = await RagEvaluation.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    res.status(200).json({
      success: true,
      stats: {
        totalEvaluations: summary.totalEvaluations,
        contextRelevance: Number(summary.avgContextRelevance.toFixed(2)),
        answerRelevance: Number(summary.avgAnswerRelevance.toFixed(2)),
        faithfulness: Number(summary.avgFaithfulness.toFixed(2)),
        averageScore: Number(summary.avgAverageScore.toFixed(2)),
      },
      history,
    })
  } catch (error) {
    logger.error("[EVALUATION] Failed to get evaluation stats:", error)
    res.status(500).json({
      success: false,
      message: "Failed to load evaluation statistics",
    })
  }
}

export const runManualEvaluation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { question, context, answer, knowledgeId } = req.body
    const userId = req.user!.id

    if (!question?.trim() || !context?.trim() || !answer?.trim()) {
      res.status(400).json({
        success: false,
        message: "question, context, and answer are required",
      })
      return
    }

    const scores = await evaluateRagResponse({ question, context, answer })

    const evaluation = await RagEvaluation.create({
      userId,
      knowledgeId: knowledgeId ? new mongoose.Types.ObjectId(knowledgeId) : undefined,
      question: question.trim(),
      context: context.trim(),
      answer: answer.trim(),
      ...scores,
    })

    res.status(200).json({
      success: true,
      message: "RAG response evaluated successfully",
      evaluation,
    })
  } catch (error) {
    logger.error("[EVALUATION] Failed to run manual evaluation:", error)
    res.status(500).json({
      success: false,
      message: "Failed to execute evaluation pipeline",
    })
  }
}
