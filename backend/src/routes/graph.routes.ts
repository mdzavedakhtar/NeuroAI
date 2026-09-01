import { Router } from "express"
import { protect } from "../middleware/auth.middleware"
import { verifyKnowledgeOwnership } from "../middleware/ownership.middleware"
import {
  queryGraphHandler,
  entityLookupHandler,
  graphStatsHandler,
} from "../controllers/graph.controller"

const router = Router()

// ======================================================
// GRAPH QUERY (natural language)
// POST /api/graph/query
// Body: { query: string, knowledgeId?: string }
// ======================================================

router.post("/query", protect, verifyKnowledgeOwnership, queryGraphHandler)

// ======================================================
// ENTITY LOOKUP (direct name search)
// POST /api/graph/entity
// Body: { entityName: string }
// ======================================================

router.post("/entity", protect, entityLookupHandler)

// ======================================================
// GRAPH STATS FOR CURRENT USER
// GET /api/graph/stats
// ======================================================

router.get("/stats", protect, graphStatsHandler)

export default router
