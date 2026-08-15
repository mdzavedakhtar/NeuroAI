import {
  mergeDocumentNode,
  mergeChunkNode,
  mergeEntityNode,
  linkChunkToEntity,
  createEntityRelationship,
  EntityType,
} from "./neo4j.service"

import { extractEntitiesAndRelationships } from "./graph.extraction.service"

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
// This is called AFTER Pinecone indexing succeeds.
// It runs asynchronously (fire-and-forget from controller)
// so it never blocks the upload response.
//
// Steps per document:
//   1. MERGE Document node
//   2. For each chunk:
//      a. MERGE Chunk node + link to Document
//      b. Extract entities + relationships via Gemini
//      c. MERGE entity nodes + link to Chunk
//      d. Create entity-entity relationships
//
// ======================================================

export const ingestChunksToGraph = async (
  chunks:  ChunkForGraphIngestion[],
  meta:    GraphIngestionMeta
): Promise<void> => {

  console.log(`[GRAPH] Starting graph ingestion for "${meta.fileName}" (${chunks.length} chunks)`)

  try {
    // Step 1: MERGE Document node
    await mergeDocumentNode({
      documentId: meta.documentId,
      userId:     meta.userId,
      fileName:   meta.fileName,
      fileType:   meta.fileType,
      uploadedAt: meta.uploadedAt,
    })

    let totalEntities = 0
    let totalRelationships = 0

    // Step 2: Process each chunk
    for (const chunk of chunks) {
      try {
        // 2a. MERGE Chunk node + CONTAINS link
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

        // 2c. MERGE entity nodes + MENTIONS links
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

        // 2d. Create entity → entity relationships
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

        totalEntities      += entities.length
        totalRelationships += relationships.length

        console.log(
          `[GRAPH] Chunk ${chunk.chunkIndex}: ${entities.length} entities, ${relationships.length} relationships`
        )
      } catch (chunkError) {
        // Per-chunk failure never stops the whole ingestion
        console.error(
          `[GRAPH] Error processing chunk ${chunk.chunkIndex}:`,
          (chunkError as Error).message
        )
      }
    }

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
