export interface User {
  _id: string
  name?: string
  email: string
  role?: string
}

export interface AuthResponse {
  success?: boolean
  token: string
  user: User
}

export interface Conversation {
  _id: string
  userId: string
  knowledgeId?: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface MessageSource {
  sourceNumber: number
  fileName: string
  chunkIndex: number
  score: number
  knowledgeId?: string
}

export interface ChatMessage {
  _id: string
  conversationId: string
  userId: string
  role: "user" | "assistant"
  content: string
  sources: MessageSource[]
  createdAt: string
  updatedAt: string
}

export interface Knowledge {
  _id: string
  userId: string
  originalName: string
  mimeType?: string
  size?: number
  status?: string
  pages?: number
  chunks?: number
  characterCount?: number
  createdAt: string
  updatedAt?: string
}

export interface ConversationsResponse {
  success: boolean
  count: number
  conversations: Conversation[]
}

export interface ConversationMessagesResponse {
  success: boolean
  conversation: Conversation
  count: number
  messages: ChatMessage[]
}

export interface SendMessageResponse {
  success: boolean
  conversationId: string
  userMessage: ChatMessage
  assistantMessage: ChatMessage
  answer: string
  sources: MessageSource[]
}

export interface ApiErrorResponse {
  success?: boolean
  message?: string
}