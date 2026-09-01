import "dotenv/config"

import { Pinecone } from "@pinecone-database/pinecone"
import KnowledgeChunk from "../models/KnowledgeChunk"
import { getCache, setCache } from "./redis.cache.service"

const apiKey = process.env.PINECONE_API_KEY
const indexName = process.env.PINECONE_INDEX_NAME

if (!apiKey) {
  throw new Error("PINECONE_API_KEY is missing in .env")
}

if (!indexName) {
  throw new Error("PINECONE_INDEX_NAME is missing in .env")
}

export const pinecone = new Pinecone({
  apiKey,
})

export const getPineconeIndex = async () => {
  const indexInfo = await pinecone.describeIndex(indexName)

  if (!indexInfo.host) {
    throw new Error("Pinecone index host not found")
  }

  return pinecone.index({
    host: indexInfo.host,
  })
}


// ======================================================
// TEST PINECONE
// ======================================================

export const testPineconeUpsert = async () => {
  const index = await getPineconeIndex()

  await index.upsertRecords({
    records: [
      {
        _id: "neurostack-test-1",
        text: "NeuroStack AI Pinecone integration test",
        source: "test",
      },
    ],
  })

  return {
    success: true,
    message: "Test record inserted into Pinecone",
  }
}


// ======================================================
// TYPES
// ======================================================

type KnowledgeChunkForPinecone = {
  _id: string
  content: string
  knowledgeId: string
  userId: string
  chunkIndex: number
  originalName: string
  pageNumber?: number
}


// ======================================================
// UPSERT CHUNKS TO PINECONE
// ======================================================

export const upsertKnowledgeChunks = async (
  chunks: KnowledgeChunkForPinecone[]
) => {
  const index = await getPineconeIndex()

  if (chunks.length === 0) {
    return {
      success: true,
      count: 0,
    }
  }

  const BATCH_SIZE = 25

  let insertedCount = 0

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    const records = batch.map((chunk) => ({
      _id: chunk._id,

      // IMPORTANT:
      // Pinecone integrated embedding index field = text
      text: chunk.content,

      knowledgeId: chunk.knowledgeId,
      userId: chunk.userId,
      chunkIndex: chunk.chunkIndex,
      originalName: chunk.originalName,
      pageNumber: chunk.pageNumber ?? 1,

      source: "knowledge",
    }))

    await index.upsertRecords({
      records,
    })

    insertedCount += records.length

    console.log(
      `✅ Pinecone batch indexed: ${insertedCount}/${chunks.length}`
    )
  }

  return {
    success: true,
    count: insertedCount,
  }
}


// ======================================================
// INDEX COMPLETE KNOWLEDGE DOCUMENT
// ======================================================

export const indexKnowledgeDocument = async (
  knowledgeId: string
) => {

  /*
   * IMPORTANT:
   *
   * We intentionally fetch all chunks for this knowledgeId.
   *
   * This also repairs chunks left in:
   * pending
   * processing
   * failed
   * ready
   *
   * Pinecone upsert is safe because same _id updates
   * the existing record instead of creating duplicates.
   */

  const chunks = await KnowledgeChunk.find({
    knowledgeId,
  }).sort({
    chunkIndex: 1,
  })

  console.log(
    `📚 Found ${chunks.length} chunks for knowledge ${knowledgeId}`
  )

  if (chunks.length === 0) {
    return {
      success: true,
      count: 0,
      total: 0,
      message: "No chunks found for this knowledge document",
    }
  }


  // ====================================================
  // MARK ALL AS PROCESSING
  // ====================================================

  await KnowledgeChunk.updateMany(
    {
      knowledgeId,
    },
    {
      $set: {
        embeddingStatus: "processing",
        embeddingError: "",
      },
    }
  )


  try {

    // ==================================================
    // PREPARE PINECONE DATA
    // ==================================================

    const pineconeChunks: KnowledgeChunkForPinecone[] =
      chunks.map((chunk) => ({
        _id: chunk._id.toString(),

        content: chunk.content,

        knowledgeId:
          chunk.knowledgeId.toString(),

        userId:
          chunk.userId.toString(),

        chunkIndex:
          chunk.chunkIndex,

        originalName:
          chunk.originalName,

        pageNumber:
          chunk.pageNumber,
      }))


    // ==================================================
    // SEND TO PINECONE
    // ==================================================

    const result =
      await upsertKnowledgeChunks(
        pineconeChunks
      )


    // ==================================================
    // MARK SUCCESSFUL CHUNKS READY
    // ==================================================

    const chunkIds =
      chunks.map((chunk) => chunk._id)

    await KnowledgeChunk.updateMany(
      {
        _id: {
          $in: chunkIds,
        },
      },
      {
        $set: {
          embeddingStatus: "ready",
          embeddingError: "",
        },
      }
    )


    // ==================================================
    // SAVE VECTOR IDs
    // ==================================================

    for (const chunk of chunks) {

      chunk.vectorId =
        chunk._id.toString()

      chunk.embeddingStatus =
        "ready"

      chunk.embeddingError =
        ""

      await chunk.save()
    }


    console.log(
      `🎉 ${result.count} chunks successfully indexed into Pinecone`
    )


    return {
      success: true,

      total: chunks.length,

      indexed: result.count,

      failed: 0,

      count: result.count,

      message:
        `${result.count} chunks indexed successfully`,
    }

  } catch (error) {

    const message =
      error instanceof Error
        ? error.message
        : "Pinecone indexing failed"


    console.error(
      "❌ Pinecone indexing failed:",
      message
    )


    // ==================================================
    // MARK FAILED
    // ==================================================

    await KnowledgeChunk.updateMany(
      {
        knowledgeId,
        embeddingStatus: "processing",
      },
      {
        $set: {
          embeddingStatus: "failed",
          embeddingError: message,
        },
      }
    )


    throw error
  }
}

// ======================================================
// SEMANTIC SEARCH
// ======================================================

export type KnowledgeSearchOptions = {
  query: string
  userId: string
  knowledgeId?: string
  topK?: number
}

export type KnowledgeSearchResult = {
  id: string
  score: number
  text: string
  knowledgeId: string
  userId: string
  chunkIndex: number
  originalName: string
  pageNumber: number
  source: string
}

type PineconeKnowledgeFields = {
  text?: string
  knowledgeId?: string
  userId?: string
  chunkIndex?: number
  originalName?: string
  pageNumber?: number
  source?: string
}


// ======================================================
// SEARCH KNOWLEDGE
// ======================================================

export const searchKnowledge = async ({
  query,
  userId,
  knowledgeId,
  topK = 5,
}: KnowledgeSearchOptions): Promise<
  KnowledgeSearchResult[]
> => {
  const cleanQuery = query.trim()

  if (!cleanQuery) {
    throw new Error("Search query is required")
  }

  console.log(`[RETRIEVAL] Initiating vector search. User: ${userId}, Document ID Filter: ${knowledgeId || "None"}, TopK: ${topK}`)

  const cacheKey = `cache:user:${userId}:search:${knowledgeId || "all"}:${cleanQuery}:${topK}`
  const cached = await getCache<KnowledgeSearchResult[]>(cacheKey)
  if (cached) {
    console.log(`[CACHE] Cache HIT for semantic search. Key: ${cacheKey}`)
    return cached
  }

  const index = await getPineconeIndex()

  // ----------------------------------------------------
  // USER FILTER
  // ----------------------------------------------------

  const filter: Record<string, string> = {
    userId,
  }

  if (knowledgeId) {
    filter.knowledgeId = knowledgeId
  }


  // ----------------------------------------------------
  // PINECONE SEMANTIC SEARCH
  // ----------------------------------------------------

  const response = await index.searchRecords({
    query: {
      inputs: {
        text: cleanQuery,
      },

      topK,

      filter,
    },

    fields: [
      "text",
      "knowledgeId",
      "userId",
      "chunkIndex",
      "originalName",
      "pageNumber",
      "source",
    ],
  })


  // ----------------------------------------------------
  // SEARCH HITS
  // ----------------------------------------------------

  const hits = response.result?.hits ?? []
  console.log(`[RETRIEVAL] Vector search completed. Total hits found: ${hits.length}`)


  // ----------------------------------------------------
  // NORMALIZE RESULTS
  // ----------------------------------------------------

  const results: KnowledgeSearchResult[] =
    hits.map((hit) => {

      const fields =
        (hit.fields ?? {}) as PineconeKnowledgeFields

      return {
        id: String(hit._id),

        score:
          typeof hit._score === "number"
            ? hit._score
            : 0,

        text:
          typeof fields.text === "string"
            ? fields.text
            : "",

        knowledgeId:
          typeof fields.knowledgeId === "string"
            ? fields.knowledgeId
            : "",

        userId:
          typeof fields.userId === "string"
            ? fields.userId
            : "",

        chunkIndex:
          typeof fields.chunkIndex === "number"
            ? fields.chunkIndex
            : 0,

        originalName:
          typeof fields.originalName === "string"
            ? fields.originalName
            : "",

        pageNumber:
          typeof fields.pageNumber === "number"
            ? fields.pageNumber
            : 1,

        source:
          typeof fields.source === "string"
            ? fields.source
            : "",
      }
    })

  if (results.length > 0) {
    const matchedDocs = Array.from(new Set(results.map(r => r.knowledgeId)))
    console.log(`[RETRIEVAL] Retrieved Chunks map to Document IDs: [${matchedDocs.join(", ")}]`)
  }

  await setCache(cacheKey, results, 300)
  return results
}


// ======================================================
// BUILD RAG CONTEXT
// ======================================================

export const buildKnowledgeContext = (
  results: KnowledgeSearchResult[]
): string => {

  if (results.length === 0) {
    return ""
  }


  const context = results
    .map((result, index) => {

      return [
        `[Source ${index + 1}]`,

        `File: ${
          result.originalName ||
          "Unknown document"
        }`,

        `Page: ${result.pageNumber || 1}`,

        `Chunk: ${result.chunkIndex}`,

        `Similarity Score: ${result.score}`,

        "",

        result.text,

      ].join("\n")

    })
    .join(
      "\n\n--------------------\n\n"
    )


  return context
}