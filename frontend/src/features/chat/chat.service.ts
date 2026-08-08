import { apiFetch } from "@/services/api"

import type {
  ConversationResponse,
  ConversationsResponse,
  MessagesResponse,
  SendMessageResponse,
} from "./chat.types"

export async function createConversation(
  title: string,
  knowledgeId?: string
) {
  return apiFetch<ConversationResponse>(
    "/chat/conversations",
    {
      method: "POST",
      body: JSON.stringify({
        title,
        ...(knowledgeId
          ? { knowledgeId }
          : {}),
      }),
    }
  )
}

export async function getConversations() {
  return apiFetch<ConversationsResponse>(
    "/chat/conversations"
  )
}

export async function getMessages(
  conversationId: string
) {
  return apiFetch<MessagesResponse>(
    `/chat/conversations/${conversationId}/messages`
  )
}

export async function sendMessage(
  conversationId: string,
  message: string
) {
  return apiFetch<SendMessageResponse>(
    `/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        message,
      }),
    }
  )
}

export async function deleteConversation(
  conversationId: string
) {
  return apiFetch<{
    success: boolean
    message: string
  }>(
    `/chat/conversations/${conversationId}`,
    {
      method: "DELETE",
    }
  )
}
