export type Source = {
  sourceNumber?: number
  fileName?: string
  chunkIndex?: number
  score?: number
  pageNumber?: number
  knowledgeId?: string
  chunkId?: string
  slideNumber?: number
  sheetName?: string
  relevanceScore?: number
}

export type Conversation = {
  _id: string
  userId: string
  knowledgeId?: string
  title: string
  createdAt?: string
  updatedAt?: string
}

export type FeedbackRating = "helpful" | "not_helpful"

export type MessageFeedback = {
  rating: FeedbackRating
  reason?: string
}

export type ChatMessage = {
  _id?: string
  conversationId?: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  feedback?: MessageFeedback
  createdAt?: string
}

export type ConversationResponse = {
  success: boolean
  conversation: Conversation
}

export type ConversationsResponse = {
  success: boolean
  count: number
  conversations: Conversation[]
}

export type MessagesResponse = {
  success: boolean
  conversation: Conversation
  count: number
  messages: ChatMessage[]
}

export type SendMessageResponse = {
  success?: boolean
  question?: string
  answer: string
  sources?: Source[]
}
