import { Response } from "express"
import { AuthRequest } from "../middleware/auth.middleware"
import { queryGraph, findEntityRelationships } from "../services/graph.query.service"
import { getGraphStatsForUser } from "../services/neo4j.service"

// ======================================================
// GET USER ID (helper)
// ======================================================

const getUserId = (req: AuthRequest): string | null => {
  return req.user?.id ?? null
}

// ======================================================
// POST /api/graph/query
//
// Natural language graph query.
//
// Body: { query: string, knowledgeId?: string }
//
// Returns: { entities, relationships, sources, summary }
// ======================================================

export const queryGraphHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req)

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    const { query, knowledgeId } = req.body as {
      query:        string
      knowledgeId?: string
    }

    if (!query || typeof query !== "string" || !query.trim()) {
      res.status(400).json({ success: false, message: "Query is required" })
      return
    }

    console.log(`[GRAPH] Query from user ${userId}: "${query}"`)

    const result = await queryGraph({
      query: query.trim(),
      userId,
      knowledgeId,
    })

    res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("[GRAPH] queryGraphHandler error:", error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Graph query failed",
    })
  }
}

// ======================================================
// POST /api/graph/entity
//
// Direct entity lookup by name.
//
// Body: { entityName: string }
//
// Returns: { entities, relationships, sources, summary }
// ======================================================

export const entityLookupHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req)

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    const { entityName } = req.body as { entityName: string }

    if (!entityName || typeof entityName !== "string" || !entityName.trim()) {
      res.status(400).json({ success: false, message: "entityName is required" })
      return
    }

    const result = await findEntityRelationships({
      entityName: entityName.trim(),
      userId,
    })

    res.status(200).json({ success: true, ...result })
  } catch (error) {
    console.error("[GRAPH] entityLookupHandler error:", error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Entity lookup failed",
    })
  }
}

// ======================================================
// GET /api/graph/stats
//
// Returns node/relationship counts for the current user.
// ======================================================

export const graphStatsHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req)

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    const stats = await getGraphStatsForUser(userId)

    res.status(200).json({ success: true, stats })
  } catch (error) {
    console.error("[GRAPH] graphStatsHandler error:", error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Graph stats failed",
    })
  }
}
