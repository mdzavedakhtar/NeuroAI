import Knowledge from "../models/Knowledge"
import KnowledgeChunk from "../models/KnowledgeChunk"
import { processDocument } from "./document.service"
import { indexKnowledgeDocument } from "./pinecone.service"
import { ingestChunksToGraph } from "./graph.ingestion.service"
import { deleteGraphForKnowledge } from "./neo4j.service"

export async function runIngestionPipeline(knowledgeId: string, userId: string): Promise<void> {
  const knowledge = await Knowledge.findById(knowledgeId)
  if (!knowledge) {
    throw new Error("Knowledge document not found")
  }

  // Prevent multiple concurrent ingestions within 5 minutes
  if (
    knowledge.status === "processing" &&
    knowledge.lastAttemptAt &&
    Date.now() - knowledge.lastAttemptAt.getTime() < 5 * 60 * 1000
  ) {
    throw new Error("Ingestion is already in progress for this document. Please wait.")
  }

  // Set to processing state
  knowledge.status = "processing"
  knowledge.currentStep = "processing"
  knowledge.errorMessage = ""
  knowledge.lastAttemptAt = new Date()
  knowledge.retryCount = (knowledge.retryCount || 0) + 1
  await knowledge.save()

  try {
    // --------------------------------------------------
    // STEP 1: PARSING (currentStep: parsing)
    // --------------------------------------------------
    knowledge.currentStep = "parsing"
    await knowledge.save()

    // Clean up old MongoDB chunks to avoid duplicates on retry
    await KnowledgeChunk.deleteMany({ knowledgeId })

    const processed = await processDocument(
      knowledge.path,
      knowledge.mimeType
    )

    // --------------------------------------------------
    // STEP 2: CHUNKING (currentStep: chunking)
    // --------------------------------------------------
    knowledge.currentStep = "chunking"
    await knowledge.save()

    const chunkDocuments = processed.chunks.map(
      (chunk, index) => ({
        knowledgeId: knowledge._id,
        userId: userId,
        chunkIndex: index,
        content: chunk,
        characterCount: chunk.length,
        sourceType: processed.fileType,
        originalName: knowledge.originalName,
        pageNumber: processed.chunkPageNumbers ? processed.chunkPageNumbers[index] : 1,
        embeddingStatus: "pending",
      })
    )

    if (chunkDocuments.length === 0) {
      throw new Error("Document contains no readable text content.")
    }

    await KnowledgeChunk.insertMany(chunkDocuments)

    // Update knowledge metadata
    knowledge.characters = processed.characters
    knowledge.chunks = chunkDocuments.length
    await knowledge.save()

    // --------------------------------------------------
    // STEP 3: VECTOR INDEXING (currentStep: vector_indexing)
    // --------------------------------------------------
    knowledge.currentStep = "vector_indexing"
    await knowledge.save()

    await indexKnowledgeDocument(knowledgeId)

    // --------------------------------------------------
    // STEP 4: GRAPH INDEXING (currentStep: graph_indexing)
    // --------------------------------------------------
    knowledge.currentStep = "graph_indexing"
    await knowledge.save()

    // Clean up old graph data before re-ingesting to ensure idempotency
    try {
      await deleteGraphForKnowledge(knowledgeId, userId)
    } catch (err) {
      console.warn("[ORCHESTRATOR] Warning: Failed to clean up old Neo4j graph data before re-ingestion:", err)
    }

    const savedChunks = await KnowledgeChunk.find({
      knowledgeId: knowledge._id,
    }).select("_id chunkIndex content pageNumber").lean()

    await ingestChunksToGraph(
      savedChunks.map((c) => ({
        chunkId:    c._id.toString(),
        chunkIndex: c.chunkIndex,
        content:    c.content,
        pageNumber: c.pageNumber ?? 1,
      })),
      {
        documentId: knowledge._id.toString(),
        userId:     userId,
        fileName:   knowledge.originalName,
        fileType:   processed.fileType,
        uploadedAt: knowledge.createdAt?.toISOString() ?? new Date().toISOString(),
      }
    )

    // --------------------------------------------------
    // STEP 5: COMPLETED (status: ready, currentStep: completed)
    // --------------------------------------------------
    knowledge.status = "ready"
    knowledge.currentStep = "completed"
    knowledge.errorMessage = ""
    await knowledge.save()

    console.log(`[ORCHESTRATOR] Ingestion pipeline successfully completed for ${knowledgeId}`)
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : "Unknown ingestion error"
    console.error(`[ORCHESTRATOR] ❌ Ingestion pipeline failed at step ${knowledge.currentStep} for ${knowledgeId}:`, errorMsg)

    knowledge.status = "failed"
    knowledge.errorMessage = errorMsg
    await knowledge.save()

    throw error
  }
}
