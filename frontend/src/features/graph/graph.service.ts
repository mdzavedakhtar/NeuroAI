import { apiFetch } from "@/services/api"

import type {
  GraphQueryResponse,
  GraphStatsResponse,
} from "./graph.types"

export async function queryGraph(
  query: string,
  knowledgeId?: string
) {
  return apiFetch<GraphQueryResponse>(
    "/graph/query",
    {
      method: "POST",
      body: JSON.stringify({
        query,
        ...(knowledgeId ? { knowledgeId } : {}),
      }),
    }
  )
}

export async function lookupEntity(
  entityName: string
) {
  return apiFetch<GraphQueryResponse>(
    "/graph/entity",
    {
      method: "POST",
      body: JSON.stringify({
        entityName,
      }),
    }
  )
}

export async function getGraphStats() {
  return apiFetch<GraphStatsResponse>(
    "/graph/stats"
  )
}
