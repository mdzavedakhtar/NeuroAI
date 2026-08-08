export type KnowledgeDocument = {
  _id: string
  userId?: string
  originalName?: string
  fileName?: string
  filename?: string
  mimeType?: string
  size?: number
  status?: string
  pages?: number
  chunks?: number
  createdAt?: string
  updatedAt?: string
}

export type KnowledgeUploadResponse = {
  success: boolean
  knowledge?: KnowledgeDocument
  document?: KnowledgeDocument
  data?: KnowledgeDocument
  message?: string

  _id?: string
  originalName?: string
  fileName?: string
  filename?: string
  status?: string
  chunks?: number
}

export type IndexKnowledgeResponse = {
  success: boolean
  total?: number
  indexed?: number
  failed?: number
  count?: number
  message?: string
}
