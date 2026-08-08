import { Router } from "express"

import {
  protect,
} from "../middleware/auth.middleware"

import {
  createConversation,
  getConversations,
  getConversationMessages,
  deleteConversation,
  sendChatMessage,
  sendChatMessageStream,
} from "../controllers/chat.controller"

const router = Router()

router.use(protect)

// Create new conversation
router.post(
  "/conversations",
  createConversation
)

// Get user's conversations
router.get(
  "/conversations",
  getConversations
)

// Get complete chat history
router.get(
  "/conversations/:conversationId/messages",
  getConversationMessages
)

// Send question + generate RAG answer
router.post(
  "/conversations/:conversationId/messages",
  sendChatMessage
)

// Stream question + generate RAG answer (SSE)
router.post(
  "/conversations/:conversationId/messages/stream",
  sendChatMessageStream
)

// Delete conversation
router.delete(
  "/conversations/:conversationId",
  deleteConversation
)

export default router