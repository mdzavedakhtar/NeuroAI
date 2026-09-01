import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  deleteMany: vi.fn(),
  processDocument: vi.fn(),
  insertMany: vi.fn(),
  indexKnowledgeDocument: vi.fn(),
  deleteGraphForKnowledge: vi.fn(),
  ingestChunksToGraph: vi.fn(),
}))

vi.mock("../models/Knowledge", () => ({
  default: {
    findById: (...args: any[]) => mocks.findById(...args),
  },
}))

vi.mock("../models/KnowledgeChunk", () => ({
  default: {
    deleteMany: (...args: any[]) => mocks.deleteMany(...args),
    insertMany: (...args: any[]) => mocks.insertMany(...args),
    find: () => ({
      select: () => ({
        lean: async () => [
          { _id: "c-1", chunkIndex: 0, content: "text 1", pageNumber: 1 }
        ],
      }),
    }),
  },
}))

vi.mock("./document.service", () => ({
  processDocument: (...args: any[]) => mocks.processDocument(...args),
}))

vi.mock("./pinecone.service", () => ({
  indexKnowledgeDocument: (...args: any[]) => mocks.indexKnowledgeDocument(...args),
}))

vi.mock("./neo4j.service", () => ({
  deleteGraphForKnowledge: (...args: any[]) => mocks.deleteGraphForKnowledge(...args),
}))

vi.mock("./graph.ingestion.service", () => ({
  ingestChunksToGraph: (...args: any[]) => mocks.ingestChunksToGraph(...args),
}))

import { runIngestionPipeline } from "./ingestion.orchestrator"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Ingestion Orchestrator Service", () => {
  it("orchestrates parser, vector indexer, and graph indexer successfully", async () => {
    const saveMock = vi.fn()
    mocks.findById.mockResolvedValue({
      _id: "doc-1",
      status: "uploaded",
      path: "/uploads/doc1.pdf",
      mimeType: "application/pdf",
      originalName: "doc1.pdf",
      save: saveMock,
    })
    mocks.processDocument.mockResolvedValue({
      chunks: ["text 1"],
      fileType: "pdf",
      characters: 6,
      chunkPageNumbers: [1],
    })

    await runIngestionPipeline("doc-1", "user-1")

    expect(mocks.processDocument).toHaveBeenCalledWith("/uploads/doc1.pdf", "application/pdf")
    expect(mocks.insertMany).toHaveBeenCalledOnce()
    expect(mocks.indexKnowledgeDocument).toHaveBeenCalledWith("doc-1")
    expect(mocks.deleteGraphForKnowledge).toHaveBeenCalledWith("doc-1", "user-1")
    expect(mocks.ingestChunksToGraph).toHaveBeenCalledOnce()
    expect(saveMock).toHaveBeenCalled()
  })
})
