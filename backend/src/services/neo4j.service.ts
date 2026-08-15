import { getSession } from "../config/neo4j"

// ======================================================
// TYPES
// ======================================================

export type EntityType =
  | "Person"
  | "Organization"
  | "Technology"
  | "Project"
  | "Product"
  | "Concept"
  | "Location"

export interface GraphEntity {
  name: string
  type: EntityType
  description?: string
  userId: string
  chunkId?: string
  documentId?: string
}

export interface GraphRelationship {
  sourceEntity: string
  sourceType: EntityType
  targetEntity: string
  targetType: EntityType
  relationshipType: string
  userId: string
  chunkId?: string
}

// ======================================================
// MERGE DOCUMENT NODE
// ======================================================

export const mergeDocumentNode = async (params: {
  documentId: string
  userId: string
  fileName: string
  fileType: string
  uploadedAt: string
}): Promise<void> => {
  const session = getSession()
  try {
    await session.run(
      `
      MERGE (d:Document { documentId: $documentId })
      SET
        d.userId      = $userId,
        d.fileName    = $fileName,
        d.fileType    = $fileType,
        d.uploadedAt  = $uploadedAt,
        d.updatedAt   = datetime()
      `,
      params
    )
  } finally {
    await session.close()
  }
}

// ======================================================
// MERGE CHUNK NODE + LINK TO DOCUMENT
// ======================================================

export const mergeChunkNode = async (params: {
  chunkId: string
  documentId: string
  userId: string
  chunkIndex: number
  pageNumber: number
  textPreview: string
}): Promise<void> => {
  const session = getSession()
  try {
    await session.run(
      `
      MERGE (c:Chunk { chunkId: $chunkId })
      SET
        c.documentId  = $documentId,
        c.userId      = $userId,
        c.chunkIndex  = $chunkIndex,
        c.pageNumber  = $pageNumber,
        c.textPreview = $textPreview,
        c.updatedAt   = datetime()

      WITH c
      MATCH (d:Document { documentId: $documentId })
      MERGE (d)-[:CONTAINS]->(c)
      `,
      params
    )
  } finally {
    await session.close()
  }
}

// ======================================================
// MERGE ENTITY NODE
// ======================================================

export const mergeEntityNode = async (entity: GraphEntity): Promise<void> => {
  const session = getSession()
  try {
    const label = entity.type // Dynamic label e.g. Technology

    await session.run(
      `
      MERGE (e:\`${label}\` { name: $name, userId: $userId })
      SET
        e.description = COALESCE($description, e.description, ""),
        e.updatedAt   = datetime()
      `,
      {
        name:        entity.name,
        userId:      entity.userId,
        description: entity.description ?? "",
      }
    )
  } finally {
    await session.close()
  }
}

// ======================================================
// LINK CHUNK → ENTITY  (MENTIONS)
// ======================================================

export const linkChunkToEntity = async (params: {
  chunkId: string
  entityName: string
  entityType: EntityType
  userId: string
}): Promise<void> => {
  const session = getSession()
  try {
    const label = params.entityType

    await session.run(
      `
      MATCH (c:Chunk { chunkId: $chunkId })
      MATCH (e:\`${label}\` { name: $entityName, userId: $userId })
      MERGE (c)-[:MENTIONS]->(e)
      `,
      {
        chunkId:    params.chunkId,
        entityName: params.entityName,
        userId:     params.userId,
      }
    )
  } finally {
    await session.close()
  }
}

// ======================================================
// CREATE ENTITY → ENTITY RELATIONSHIP
// ======================================================

// Allowlist of safe relationship types to prevent Cypher injection
const ALLOWED_REL_TYPES = new Set([
  "WORKS_AT",
  "USES",
  "CREATED",
  "RELATED_TO",
  "PART_OF",
  "LOCATED_IN",
  "MANAGES",
  "DEVELOPS",
  "COMPETES_WITH",
])

export const createEntityRelationship = async (
  rel: GraphRelationship
): Promise<void> => {
  // Sanitize relationship type
  const relType = rel.relationshipType
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")

  const safeRelType = ALLOWED_REL_TYPES.has(relType) ? relType : "RELATED_TO"

  const session = getSession()
  try {
    const srcLabel = rel.sourceType
    const tgtLabel = rel.targetType

    await session.run(
      `
      MATCH (src:\`${srcLabel}\` { name: $sourceName, userId: $userId })
      MATCH (tgt:\`${tgtLabel}\` { name: $targetName, userId: $userId })
      MERGE (src)-[r:\`${safeRelType}\`]->(tgt)
      SET r.updatedAt = datetime()
      `,
      {
        sourceName: rel.sourceEntity,
        targetName: rel.targetEntity,
        userId:     rel.userId,
      }
    )
  } finally {
    await session.close()
  }
}

// ======================================================
// DELETE ALL GRAPH DATA FOR A KNOWLEDGE DOCUMENT
// Called on document delete to keep graph clean.
// ======================================================

export const deleteGraphForKnowledge = async (
  documentId: string,
  userId: string
): Promise<void> => {
  const session = getSession()
  try {
    // Delete all chunks + their MENTIONS relationships first
    await session.run(
      `
      MATCH (d:Document { documentId: $documentId, userId: $userId })-[:CONTAINS]->(c:Chunk)
      DETACH DELETE c
      `,
      { documentId, userId }
    )

    // Delete the document node itself
    await session.run(
      `
      MATCH (d:Document { documentId: $documentId, userId: $userId })
      DETACH DELETE d
      `,
      { documentId, userId }
    )

    console.log(`[NEO4J] Deleted graph nodes for document ${documentId}`)
  } catch (error) {
    console.error(`[NEO4J] Failed to delete graph for ${documentId}:`, error)
    throw error
  } finally {
    await session.close()
  }
}

// ======================================================
// GET GRAPH STATS FOR A USER
// ======================================================

export const getGraphStatsForUser = async (
  userId: string
): Promise<Record<string, number>> => {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (d:Document { userId: $userId })
      WITH count(d) AS documents
      OPTIONAL MATCH (c:Chunk { userId: $userId })
      WITH documents, count(c) AS chunks
      OPTIONAL MATCH (e WHERE e.userId = $userId AND NOT e:Document AND NOT e:Chunk)
      RETURN documents, chunks, count(e) AS entities
      `,
      { userId }
    )

    const record = result.records[0]
    return {
      documents: record?.get("documents")?.toNumber?.() ?? 0,
      chunks:    record?.get("chunks")?.toNumber?.()    ?? 0,
      entities:  record?.get("entities")?.toNumber?.()  ?? 0,
    }
  } finally {
    await session.close()
  }
}
