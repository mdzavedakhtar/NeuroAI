import { apiFetch } from "@/services/api"

import type {
  IndexKnowledgeResponse,
  KnowledgeUploadResponse,
} from "./knowledge.types"

export async function uploadKnowledge(
  file: File
) {
  const formData = new FormData()

  formData.append("file", file)

  return apiFetch<KnowledgeUploadResponse>(
    "/knowledge/upload",
    {
      method: "POST",
      body: formData,
    }
  )
}

export async function indexKnowledge(
  knowledgeId: string
) {
  return apiFetch<IndexKnowledgeResponse>(
    `/knowledge/${knowledgeId}/index`,
    {
      method: "POST",
    }
  )
}

export function extractKnowledgeId(
  response: KnowledgeUploadResponse
) {
  return (
    response.knowledge?.id ??
    response.knowledge?._id ??
    response.document?.id ??
    response.document?._id ??
    response.data?.id ??
    response.data?._id ??
    response.id ??
    response._id ??
    null
  )
}

export async function getKnowledgeSources() {
  return apiFetch<{
    success: boolean
    sources: Array<{
      _id: string
      originalName: string
      mimeType: string
      size: number
      status: string
      chunks: number
      createdAt: string
    }>
  }>("/knowledge")
}

export async function deleteKnowledgeSource(knowledgeId: string) {
  return apiFetch<{
    success: boolean
    message: string
  }>(`/knowledge/${knowledgeId}`, {
    method: "DELETE",
  })
}
