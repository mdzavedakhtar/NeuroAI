import pLimit from "p-limit"
import {
  mergeDocumentNode,
  mergeChunkNode,
  mergeEntityNode,
  linkChunkToEntity,
  createEntityRelationship,
  EntityType,
} from "./neo4j.service.js"

import { extractEntitiesAndRelationships } from "./graph.extraction.service.js"

// ======================================================
// TYPES
// ======================================================

export interface ChunkForGraphIngestion {
  chunkId:    string   // MongoDB _id of KnowledgeChunk
  chunkIndex: number
  content:    string
  pageNumber: number
}

export interface GraphIngestionMeta {
  documentId: string   // MongoDB Knowledge _id
  userId:     string
  fileName:   string
  fileType:   string
  uploadedAt: string
}

// ======================================================
// INGEST CHUNKS TO GRAPH
// ======================================================
//
// Called AFTER Pinecone indexing succeeds.
// Runs asynchronously (fire-and-forget from the orchestrator).
//
// Steps per document:
//   1. MERGE Document node
//   2. For each chunk (bounded concurrency, up to 5 parallel):
//      a. MERGE Chunk node + link to Document
//      b. Extract entities + relationships via Gemini
//      c. MERGE entity nodes + link to Chunk
//      d. Create entity-entity relationships
//
// Neo4j MERGE operations are inherently idempotent — re-running
// the same chunk twice will not create duplicate nodes or edges.
// ======================================================

// Max parallel Gemini API calls for entity extraction.
// Keep at ≤5 to stay well within Gemini rate limits.
const CHUNK_CONCURRENCY = 5

export const ingestChunksToGraph = async (
  chunks:  ChunkForGraphIngestion[],
  meta:    GraphIngestionMeta
): Promise<void> => {

  console.log(`[GRAPH] Starting graph ingestion for "${meta.fileName}" (${chunks.length} chunks)`)

  try {
    // Step 1: MERGE Document node (idempotent)
    await mergeDocumentNode({
      documentId: meta.documentId,
      userId:     meta.userId,
      fileName:   meta.fileName,
      fileType:   meta.fileType,
      uploadedAt: meta.uploadedAt,
    })

    const limit = pLimit(CHUNK_CONCURRENCY)
    let totalEntities = 0
    let totalRelationships = 0

    // Step 2: Process chunks in parallel (bounded concurrency)
    const results = await Promise.all(
      chunks.map((chunk) =>
        limit(async () => {
          try {
            // 2a. MERGE Chunk node + CONTAINS link (idempotent)
            await mergeChunkNode({
              chunkId:     chunk.chunkId,
              documentId:  meta.documentId,
              userId:      meta.userId,
              chunkIndex:  chunk.chunkIndex,
              pageNumber:  chunk.pageNumber,
              textPreview: chunk.content.slice(0, 200),
            })

            // 2b. Extract entities and relationships
            const { entities, relationships } =
              await extractEntitiesAndRelationships(
                chunk.content,
                chunk.chunkIndex,
                meta.fileName
              )

            // 2c. MERGE entity nodes + MENTIONS links (idempotent)
            for (const entity of entities) {
              await mergeEntityNode({
                name:        entity.name,
                type:        entity.type as EntityType,
                description: entity.description,
                userId:      meta.userId,
                chunkId:     chunk.chunkId,
                documentId:  meta.documentId,
              })

              await linkChunkToEntity({
                chunkId:    chunk.chunkId,
                entityName: entity.name,
                entityType: entity.type as EntityType,
                userId:     meta.userId,
              })
            }

            // 2d. Create entity → entity relationships (idempotent MERGE)
            for (const rel of relationships) {
              await createEntityRelationship({
                sourceEntity:     rel.sourceEntity,
                sourceType:       rel.sourceType,
                targetEntity:     rel.targetEntity,
                targetType:       rel.targetType,
                relationshipType: rel.relationshipType,
                userId:           meta.userId,
                chunkId:          chunk.chunkId,
              })
            }

            console.log(
              `[GRAPH] Chunk ${chunk.chunkIndex}: ${entities.length} entities, ${relationships.length} relationships`
            )
            return { entities: entities.length, relationships: relationships.length }
          } catch (chunkError) {
            // Per-chunk failure never stops the whole ingestion
            console.error(
              `[GRAPH] Error processing chunk ${chunk.chunkIndex}:`,
              (chunkError as Error).message
            )
            return { entities: 0, relationships: 0 }
          }
        })
      )
    )

    // Tally totals
    results.forEach((r) => {
      totalEntities      += r.entities
      totalRelationships += r.relationships
    })

    console.log(
      `[GRAPH] ✅ Ingestion complete for "${meta.fileName}": ` +
      `${totalEntities} entities, ${totalRelationships} relationships`
    )
  } catch (error) {
    console.error(
      `[GRAPH] ❌ Graph ingestion failed for "${meta.fileName}":`,
      (error as Error).message
    )
    throw error
  }
}
