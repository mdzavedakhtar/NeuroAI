import "dotenv/config"
import { GoogleGenAI } from "@google/genai"
import type { EntityType } from "./neo4j.service"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const extractionModel = process.env.GEMINI_MODEL || "gemini-2.5-flash"

// ======================================================
// TYPES
// ======================================================

export interface ExtractedEntity {
  name:        string
  type:        EntityType
  description: string
}

export interface ExtractedRelationship {
  sourceEntity: string
  sourceType:   EntityType
  targetEntity: string
  targetType:   EntityType
  relationshipType: string
}

export interface ExtractionResult {
  entities:      ExtractedEntity[]
  relationships: ExtractedRelationship[]
}

const VALID_ENTITY_TYPES: EntityType[] = [
  "Person",
  "Organization",
  "Technology",
  "Project",
  "Product",
  "Concept",
  "Location",
]

const VALID_REL_TYPES = [
  "WORKS_AT",
  "USES",
  "CREATED",
  "RELATED_TO",
  "PART_OF",
  "LOCATED_IN",
  "MANAGES",
  "DEVELOPS",
  "COMPETES_WITH",
]

// ======================================================
// EXTRACT ENTITIES + RELATIONSHIPS FROM A TEXT CHUNK
// ======================================================

export const extractEntitiesAndRelationships = async (
  chunkText: string,
  chunkIndex: number,
  fileName: string
): Promise<ExtractionResult> => {

  // Skip very short chunks — not enough signal
  if (chunkText.trim().length < 80) {
    return { entities: [], relationships: [] }
  }

  const prompt = `
You are a knowledge graph extraction engine.

Given the following text chunk from a document, extract:
1. Named entities (people, organizations, technologies, projects, products, concepts, locations)
2. Relationships between those entities

STRICT RULES:
- Only extract entities that are explicitly mentioned in the text.
- Do NOT invent entities or relationships.
- Entity names must be as they appear in the text (normalized, title-case).
- Entity types must be EXACTLY one of: ${VALID_ENTITY_TYPES.join(", ")}
- Relationship types must be EXACTLY one of: ${VALID_REL_TYPES.join(", ")}
- Return ONLY valid JSON. No markdown, no explanation.
- If no entities are found, return empty arrays.

JSON FORMAT:
{
  "entities": [
    { "name": "Entity Name", "type": "EntityType", "description": "short description" }
  ],
  "relationships": [
    {
      "sourceEntity": "Entity A",
      "sourceType": "EntityType",
      "targetEntity": "Entity B",
      "targetType": "EntityType",
      "relationshipType": "REL_TYPE"
    }
  ]
}

TEXT CHUNK (from "${fileName}", chunk ${chunkIndex}):
---
${chunkText.slice(0, 2000)}
---

Respond with ONLY the JSON object.
`

  try {
    const response = await ai.models.generateContent({
      model: extractionModel,
      contents: prompt,
    })

    const raw = (response.text || "").trim()

    // Strip markdown code fences if present
    const jsonText = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim()

    const parsed = JSON.parse(jsonText) as ExtractionResult

    // Validate and filter entities
    const entities = (parsed.entities ?? []).filter(
      (e): e is ExtractedEntity =>
        typeof e.name === "string" &&
        e.name.length > 0 &&
        VALID_ENTITY_TYPES.includes(e.type as EntityType)
    )

    // Validate and filter relationships
    const relationships = (parsed.relationships ?? []).filter(
      (r): r is ExtractedRelationship =>
        typeof r.sourceEntity === "string" &&
        typeof r.targetEntity === "string" &&
        VALID_ENTITY_TYPES.includes(r.sourceType as EntityType) &&
        VALID_ENTITY_TYPES.includes(r.targetType as EntityType) &&
        VALID_REL_TYPES.includes(r.relationshipType)
    )

    return { entities, relationships }
  } catch (error) {
    // Extraction is best-effort — log and continue
    console.warn(
      `[GRAPH] Entity extraction failed for chunk ${chunkIndex} of "${fileName}":`,
      (error as Error).message
    )
    return { entities: [], relationships: [] }
  }
}
