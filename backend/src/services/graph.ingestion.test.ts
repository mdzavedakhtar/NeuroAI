import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  mergeDocumentNode: vi.fn(),
  mergeChunkNode: vi.fn(),
  mergeEntityNode: vi.fn(),
  linkChunkToEntity: vi.fn(),
  createEntityRelationship: vi.fn(),
  extractEntitiesAndRelationships: vi.fn(),
}))

vi.mock("./neo4j.service.js", () => ({
  mergeDocumentNode: (...args: any[]) => mocks.mergeDocumentNode(...args),
  mergeChunkNode: (...args: any[]) => mocks.mergeChunkNode(...args),
  mergeEntityNode: (...args: any[]) => mocks.mergeEntityNode(...args),
  linkChunkToEntity: (...args: any[]) => mocks.linkChunkToEntity(...args),
  createEntityRelationship: (...args: any[]) => mocks.createEntityRelationship(...args),
}))

vi.mock("./graph.extraction.service.js", () => ({
  extractEntitiesAndRelationships: (...args: any[]) => mocks.extractEntitiesAndRelationships(...args),
}))

import { ingestChunksToGraph } from "./graph.ingestion.service"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Graph Ingestion Concurrent service", () => {
  it("processes list of chunks concurrently and merges entity nodes/links correctly", async () => {
    mocks.mergeDocumentNode.mockResolvedValue({})
    mocks.mergeChunkNode.mockResolvedValue({})
    mocks.extractEntitiesAndRelationships.mockResolvedValue({
      entities: [{ name: "React", type: "Technology", description: "UI Library" }],
      relationships: [{
        sourceEntity: "React",
        sourceType: "Technology",
        targetEntity: "Web",
        targetType: "Concept",
        relationshipType: "USES",
      }],
    })

    const chunks = [
      { chunkId: "chunk-1", chunkIndex: 0, content: "React is a UI library", pageNumber: 1 },
      { chunkId: "chunk-2", chunkIndex: 1, content: "We build web apps with React", pageNumber: 2 },
    ]

    const meta = {
      documentId: "doc-123",
      userId: "user-456",
      fileName: "react.txt",
      fileType: "txt",
      uploadedAt: new Date().toISOString(),
    }

    await ingestChunksToGraph(chunks, meta)

    expect(mocks.mergeDocumentNode).toHaveBeenCalledOnce()
    expect(mocks.mergeChunkNode).toHaveBeenCalledTimes(2)
    expect(mocks.extractEntitiesAndRelationships).toHaveBeenCalledTimes(2)
    expect(mocks.mergeEntityNode).toHaveBeenCalledTimes(2)
    expect(mocks.linkChunkToEntity).toHaveBeenCalledTimes(2)
    expect(mocks.createEntityRelationship).toHaveBeenCalledTimes(2)
  })
})
