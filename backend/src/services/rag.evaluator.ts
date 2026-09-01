import { getProvider } from "./llm/llm.registry"
import { getActivePrompt, renderPrompt } from "./prompt.service"
import { logger } from "../utils/logger"

export interface EvaluationScores {
  contextRelevance: number
  answerRelevance: number
  faithfulness: number
  averageScore: number
}

/**
 * Uses the default LLM provider (Gemini) as a judge to evaluate RAG response quality.
 * Scores context relevance, answer relevance, and faithfulness on a 0-1 scale.
 */
export async function evaluateRagResponse(params: {
  question: string
  context: string
  answer: string
}): Promise<EvaluationScores> {
  const { question, context, answer } = params

  try {
    const template = await getActivePrompt("rag_evaluator")
    const prompt = renderPrompt(template, { question, context, answer })

    const provider = getProvider()
    const response = await provider.generate({ prompt })

    const cleanText = response.text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim()

    const scores = JSON.parse(cleanText) as {
      contextRelevance: number
      answerRelevance: number
      faithfulness: number
    }

    const contextRelevance = Math.min(1, Math.max(0, Number(scores.contextRelevance) || 0))
    const answerRelevance = Math.min(1, Math.max(0, Number(scores.answerRelevance) || 0))
    const faithfulness = Math.min(1, Math.max(0, Number(scores.faithfulness) || 0))
    const averageScore = Number(((contextRelevance + answerRelevance + faithfulness) / 3).toFixed(2))

    return {
      contextRelevance,
      answerRelevance,
      faithfulness,
      averageScore,
    }
  } catch (error) {
    logger.error("[EVALUATOR] Failed to evaluate RAG response:", error)
    // Return a default zero score tuple on parsing/execution failures
    return {
      contextRelevance: 0,
      answerRelevance: 0,
      faithfulness: 0,
      averageScore: 0,
    }
  }
}
