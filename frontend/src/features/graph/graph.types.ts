export type GraphNode = {
  id: string
  labels: string[]
  name: string
  description: string
  documentId: string
  chunkId: string
}

export type GraphRelationship = {
  source: string
  sourceType: string
  target: string
  targetType: string
  relationshipType: string
}

export type GraphSourceRef = {
  chunkId: string
  documentId: string
  pageNumber: number
  chunkIndex: number
  fileName: string
}

export type GraphQueryResult = {
  query: string
  entities: GraphNode[]
  relationships: GraphRelationship[]
  sources: GraphSourceRef[]
  summary: string
}

export type GraphStats = {
  documents: number
  chunks: number
  entities: number
}

export type GraphStatsResponse = {
  success: boolean
  stats: GraphStats
}

export type GraphQueryResponse = {
  success: boolean
  message?: string
} & GraphQueryResult
