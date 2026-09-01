import Message from "../models/Message"
import { getProvider } from "./llm/llm.registry"
import { getActivePrompt, renderPrompt } from "./prompt.service"
import { logger } from "../utils/logger"

const SHORT_TERM_WINDOW = Number(process.env.MEMORY_SHORT_TERM_WINDOW) || 8
const SUMMARIZE_THRESHOLD = Number(process.env.MEMORY_SUMMARIZE_THRESHOLD) || 20

export interface MemoryContext {
  conversationHistory: string
  messageCount: number
  summarized: boolean
}

/**
 * Builds a conversational memory string for injection into LLM prompts.
 * - If message count <= SHORT_TERM_WINDOW: use recent messages verbatim
 * - If message count > SUMMARIZE_THRESHOLD: summarize older messages + append recent
 */
export async function buildMemoryContext(
  conversationId: string,
  userId: string
): Promise<MemoryContext> {
  try {
    const messages = await Message.find({ conversationId, userId })
      .sort({ createdAt: 1 })
      .select("role content")
      .lean()

    if (messages.length === 0) {
      return { conversationHistory: "No prior conversation.", messageCount: 0, summarized: false }
    }

    // Short conversation — use recent window verbatim
    if (messages.length <= SHORT_TERM_WINDOW) {
      const history = messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n")
      return { conversationHistory: history, messageCount: messages.length, summarized: false }
    }

    // Long conversation — summarize older messages, append recent window
    const recentMessages = messages.slice(-SHORT_TERM_WINDOW)
    const olderMessages = messages.slice(0, -SHORT_TERM_WINDOW)

    let summary = ""
    if (olderMessages.length >= SUMMARIZE_THRESHOLD - SHORT_TERM_WINDOW) {
      try {
        const olderText = olderMessages
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n")
        const template = await getActivePrompt("conversation_summarizer")
        const prompt = renderPrompt(template, { messages: olderText })
        const provider = getProvider()
        const response = await provider.generate({ prompt })
        summary = `[Conversation Summary: ${response.text}]`
      } catch (err) {
        logger.warn("[MEMORY] Failed to summarize older messages:", err)
        // Fallback: use last 3 of older messages
        summary = `[Earlier conversation had ${olderMessages.length} messages]`
      }
    }

    const recentHistory = recentMessages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n")

    const conversationHistory = summary
      ? `${summary}\n\nRecent conversation:\n${recentHistory}`
      : recentHistory

    return { conversationHistory, messageCount: messages.length, summarized: true }
  } catch (err) {
    logger.error("[MEMORY] Failed to build memory context:", err)
    return { conversationHistory: "No prior conversation.", messageCount: 0, summarized: false }
  }
}
