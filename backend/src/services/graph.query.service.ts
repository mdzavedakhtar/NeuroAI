import { getSession } from "../config/neo4j"
import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const model = process.env.GEMINI_MODEL || "gemini-2.0-flash"

// ======================================================
// TYPES
// ======================================================

export interface GraphNodeResult {
  id:          string
  labels:      string[]
  name:        string
  description: string
  documentId:  string
  chunkId:     string
}

export interface GraphRelationshipResult {
  source:           string
  sourceType:       string
  target:           string
  targetType:       string
  relationshipType: string
}

export interface GraphSourceRef {
  chunkId:    string
  documentId: string
  pageNumber: number
  chunkIndex: number
  fileName:   string
}

export interface GraphQueryResult {
  query:         string
  entities:      GraphNodeResult[]
  relationships: GraphRelationshipResult[]
  sources:       GraphSourceRef[]
  summary:       string
}

// ======================================================
// EXTRACT SEARCH TERMS FROM NATURAL LANGUAGE QUERY
// Uses Gemini to identify key entity names to look up.
// ======================================================

const extractSearchTerms = async (query: string): Promise<string[]> => {
  const prompt = `
Extract the key named entities (people, tools, technologies, organizations, projects, products, concepts, locations) from this query.
Return ONLY a JSON array of strings. No explanation. Example: ["React", "TypeScript", "Google"]

Query: "${query}"
`

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    })

    const raw = (response.text || "").trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim()

    const terms = JSON.parse(raw) as string[]
    return Array.isArray(terms) ? terms.filter(t => typeof t === "string") : []
  } catch {
    // Fallback: split query into words ≥ 3 chars
    return query
      .split(/\s+/)
      .filter(w => w.length >= 3)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, ""))
      .filter(Boolean)
  }
}

// ======================================================
// QUERY GRAPH BY NATURAL LANGUAGE
// ======================================================

export const queryGraph = async (params: {
  query:       string
  userId:      string
  knowledgeId?: string
}): Promise<GraphQueryResult> => {

  const { query, userId } = params
  const session = getSession()

  try {
    // 1. Extract search terms from natural language query
    const searchTerms = await extractSearchTerms(query)
    console.log(`[GRAPH QUERY] Search terms: ${searchTerms.join(", ")}`)

    if (searchTerms.length === 0) {
      return {
        query,
        entities:      [],
        relationships: [],
        sources:       [],
        summary:       "No named entities found in your query to search the knowledge graph.",
      }
    }

    // 2. Find matching entity nodes (user-isolated, case-insensitive)
    //    Then traverse 2-hop neighborhood
    const termConditions = searchTerms
      .map((_, i) => `toLower(e.name) CONTAINS toLower($term${i})`)
      .join(" OR ")

    const termParams: Record<string, string> = { userId }
    searchTerms.forEach((term, i) => {
      termParams[`term${i}`] = term
    })

    const entityQuery = `
      MATCH (e)
      WHERE e.userId = $userId
        AND NOT e:Document
        AND NOT e:Chunk
        AND (${termConditions})

      // 2-hop neighborhood
      OPTIONAL MATCH (e)-[r1]-(neighbor)
      WHERE neighbor.userId = $userId
        AND NOT neighbor:Document
        AND NOT neighbor:Chunk

      OPTIONAL MATCH (neighbor)-[r2]-(neighbor2)
      WHERE neighbor2.userId = $userId
        AND NOT neighbor2:Document
        AND NOT neighbor2:Chunk

      // Source chunks that mention these entities
      OPTIONAL MATCH (c:Chunk { userId: $userId })-[:MENTIONS]->(e)
      OPTIONAL MATCH (d:Document { userId: $userId })-[:CONTAINS]->(c)

      RETURN DISTINCT
        e,
        collect(DISTINCT neighbor)   AS neighbors,
        collect(DISTINCT r1)         AS rels1,
        collect(DISTINCT neighbor2)  AS neighbors2,
        collect(DISTINCT r2)         AS rels2,
        collect(DISTINCT c)          AS chunks,
        collect(DISTINCT d)          AS docs
    `

    const result = await session.run(entityQuery, termParams)

    // 3. Collect unique entities
    const entityMap = new Map<string, GraphNodeResult>()
    const relMap    = new Map<string, GraphRelationshipResult>()
    const sourceMap = new Map<string, GraphSourceRef>()

    for (const record of result.records) {
      const e = record.get("e")
      if (e) addEntityToMap(e, entityMap)

      const neighbors = record.get("neighbors") ?? []
      for (const n of neighbors) addEntityToMap(n, entityMap)

      const neighbors2 = record.get("neighbors2") ?? []
      for (const n of neighbors2) addEntityToMap(n, entityMap)

      const rels1 = record.get("rels1") ?? []
      for (const r of rels1) addRelToMap(r, relMap)

      const rels2 = record.get("rels2") ?? []
      for (const r of rels2) addRelToMap(r, relMap)

      // Source chunks
      const chunks = record.get("chunks") ?? []
      const docs   = record.get("docs")   ?? []
      const docMap = new Map<string, string>()
      for (const d of docs) {
        if (d?.properties) {
          docMap.set(d.properties.documentId, d.properties.fileName ?? "")
        }
      }

      for (const c of chunks) {
        if (c?.properties) {
          const cProps = c.properties
          const cId = String(cProps.chunkId ?? "")
          if (!sourceMap.has(cId)) {
            sourceMap.set(cId, {
              chunkId:    cId,
              documentId: String(cProps.documentId ?? ""),
              pageNumber: Number(cProps.pageNumber  ?? 1),
              chunkIndex: Number(cProps.chunkIndex  ?? 0),
              fileName:   docMap.get(String(cProps.documentId ?? "")) ?? "",
            })
          }
        }
      }
    }

    const entities      = Array.from(entityMap.values())
    const relationships = Array.from(relMap.values())
    const sources       = Array.from(sourceMap.values())

    // 4. Generate human-readable summary
    const summary = await generateGraphSummary(query, entities, relationships)

    return { query, entities, relationships, sources, summary }

  } finally {
    await session.close()
  }
}

// ======================================================
// HELPER: Add entity node to map (deduplicated)
// ======================================================

function addEntityToMap(
  node: any,
  map: Map<string, GraphNodeResult>
): void {
  if (!node?.properties) return
  const props = node.properties
  const name  = String(props.name ?? "")
  if (!name || map.has(name)) return

  map.set(name, {
    id:          node.elementId ?? name,
    labels:      node.labels ?? [],
    name,
    description: String(props.description ?? ""),
    documentId:  String(props.documentId  ?? ""),
    chunkId:     String(props.chunkId     ?? ""),
  })
}

// ======================================================
// HELPER: Add relationship to map (deduplicated)
// ======================================================

function addRelToMap(
  rel: any,
  map: Map<string, GraphRelationshipResult>
): void {
  if (!rel) return

  const startLabel = rel.startNodeElementId ?? ""
  const endLabel   = rel.endNodeElementId   ?? ""
  const relType    = rel.type ?? "RELATED_TO"
  const key        = `${startLabel}-${relType}-${endLabel}`

  if (map.has(key)) return

  map.set(key, {
    source:           String(rel.startNodeElementId ?? ""),
    sourceType:       "",  // filled from node labels if needed
    target:           String(rel.endNodeElementId   ?? ""),
    targetType:       "",
    relationshipType: relType,
  })
}

// ======================================================
// GENERATE SUMMARY OF GRAPH RESULTS
// ======================================================

const generateGraphSummary = async (
  query:         string,
  entities:      GraphNodeResult[],
  relationships: GraphRelationshipResult[]
): Promise<string> => {

  if (entities.length === 0) {
    return `No entities found in the knowledge graph for: "${query}"`
  }

  const entityList = entities
    .slice(0, 15)
    .map(e => `- ${e.name} (${e.labels.join(", ")})${e.description ? ": " + e.description : ""}`)
    .join("\n")

  const relList = relationships
    .slice(0, 10)
    .map(r => `- [${r.source}] --${r.relationshipType}--> [${r.target}]`)
    .join("\n")

  const prompt = `
You are a knowledge graph analyst. Summarize the following graph query results in 2-3 sentences.

Query: "${query}"

Entities found:
${entityList}

${relationships.length > 0 ? `Relationships:\n${relList}` : "No direct relationships found."}

Write a concise, factual summary. Do not add information not present above.
`

  try {
    const response = await ai.models.generateContent({ model, contents: prompt })
    return (response.text ?? "").trim()
  } catch {
    return `Found ${entities.length} entities and ${relationships.length} relationships related to your query.`
  }
}

// ======================================================
// FIND ENTITY RELATIONSHIPS (direct lookup by name)
// ======================================================

export const findEntityRelationships = async (params: {
  entityName: string
  userId:     string
}): Promise<GraphQueryResult> => {
  const { entityName, userId } = params
  const session = getSession()

  try {
    const result = await session.run(
      `
      MATCH (e { userId: $userId })
      WHERE toLower(e.name) = toLower($entityName)
        AND NOT e:Document AND NOT e:Chunk

      OPTIONAL MATCH (e)-[r]-(neighbor)
      WHERE neighbor.userId = $userId
        AND NOT neighbor:Document AND NOT neighbor:Chunk

      OPTIONAL MATCH (c:Chunk { userId: $userId })-[:MENTIONS]->(e)
      OPTIONAL MATCH (d:Document { userId: $userId })-[:CONTAINS]->(c)

      RETURN
        e,
        collect(DISTINCT neighbor) AS neighbors,
        collect(DISTINCT r)        AS rels,
        collect(DISTINCT c)        AS chunks,
        collect(DISTINCT d)        AS docs
      `,
      { entityName, userId }
    )

    const entityMap = new Map<string, GraphNodeResult>()
    const relMap    = new Map<string, GraphRelationshipResult>()
    const sourceMap = new Map<string, GraphSourceRef>()

    for (const record of result.records) {
      const e = record.get("e")
      if (e) addEntityToMap(e, entityMap)

      for (const n of (record.get("neighbors") ?? [])) addEntityToMap(n, entityMap)
      for (const r of (record.get("rels")      ?? [])) addRelToMap(r, relMap)

      const docs   = record.get("docs")   ?? []
      const chunks = record.get("chunks") ?? []
      const docFileMap = new Map<string, string>()
      for (const d of docs) {
        if (d?.properties) docFileMap.set(d.properties.documentId, d.properties.fileName ?? "")
      }

      for (const c of chunks) {
        if (c?.properties) {
          const cProps = c.properties
          const cId    = String(cProps.chunkId ?? "")
          if (!sourceMap.has(cId)) {
            sourceMap.set(cId, {
              chunkId:    cId,
              documentId: String(cProps.documentId ?? ""),
              pageNumber: Number(cProps.pageNumber  ?? 1),
              chunkIndex: Number(cProps.chunkIndex  ?? 0),
              fileName:   docFileMap.get(String(cProps.documentId ?? "")) ?? "",
            })
          }
        }
      }
    }

    const entities      = Array.from(entityMap.values())
    const relationships = Array.from(relMap.values())
    const sources       = Array.from(sourceMap.values())
    const summary       = await generateGraphSummary(entityName, entities, relationships)

    return { query: entityName, entities, relationships, sources, summary }

  } finally {
    await session.close()
  }
}
