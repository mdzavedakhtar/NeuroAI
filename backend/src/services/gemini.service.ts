import { getProvider } from "./llm/llm.registry"
import { getActivePrompt, renderPrompt } from "./prompt.service"

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type GenerateRagAnswerOptions = {
  question: string
  context: string
  conversationHistory?: string
  model?: string
  providerName?: string
}

// ──────────────────────────────────────────────────────────────────────────────
// Non-streaming RAG answer
// ──────────────────────────────────────────────────────────────────────────────

export const generateRagAnswer = async ({
  question,
  context,
  conversationHistory = "",
  model,
  providerName,
}: GenerateRagAnswerOptions): Promise<string> => {
  const provider = getProvider(providerName)

  const cleanQuestion = question.trim()
  const cleanContext = context.trim()

  if (!cleanQuestion) throw new Error("Question is required")

  let prompt: string

  if (!cleanContext) {
    const template = await getActivePrompt("rag_answer_no_context")
    prompt = renderPrompt(template, {
      question: cleanQuestion,
      conversationHistory: conversationHistory || "No prior conversation.",
    })
  } else {
    const template = await getActivePrompt("rag_answer")
    prompt = renderPrompt(template, {
      context: cleanContext,
      question: cleanQuestion,
      conversationHistory: conversationHistory || "No prior conversation.",
    })
  }

  const response = await provider.generate({ prompt, model })

  if (!response.text) throw new Error("LLM returned an empty response")
  return response.text
}

// ──────────────────────────────────────────────────────────────────────────────
// Streaming RAG answer
// ──────────────────────────────────────────────────────────────────────────────

export const generateRagAnswerStream = async ({
  question,
  context,
  conversationHistory = "",
  model,
  providerName,
}: GenerateRagAnswerOptions): Promise<AsyncIterable<string>> => {
  const provider = getProvider(providerName)

  const cleanQuestion = question.trim()
  const cleanContext = context.trim()

  if (!cleanQuestion) throw new Error("Question is required")

  let prompt: string

  if (!cleanContext) {
    const template = await getActivePrompt("rag_answer_no_context")
    prompt = renderPrompt(template, {
      question: cleanQuestion,
      conversationHistory: conversationHistory || "No prior conversation.",
    })
  } else {
    const template = await getActivePrompt("rag_answer")
    prompt = renderPrompt(template, {
      context: cleanContext,
      question: cleanQuestion,
      conversationHistory: conversationHistory || "No prior conversation.",
    })
  }

  return provider.stream({ prompt, model })
}