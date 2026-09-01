import type { AiTool, ToolInput, ToolResult, ToolContext } from "./tool.interface"
import { queryGraph } from "../graph.query.service"

export class GraphQueryTool implements AiTool {
  readonly name = "graph-query"
  readonly description = "Queries the Neo4j knowledge graph using natural language and returns entities and relationship paths"
  readonly inputSchema = {
    query: { type: "string", required: true, description: "The natural language query to run against the graph" },
  }

  validate(input: ToolInput) {
    const errors: string[] = []
    if (!input.query || typeof input.query !== "string" || !input.query.trim()) {
      errors.push("query is required and must be a non-empty string")
    }
    return { valid: errors.length === 0, errors }
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await queryGraph({
        query: input.query.trim(),
        userId: context.userId,
        knowledgeId: context.knowledgeId,
      })

      return {
        success: true,
        output: result.summary,
        metadata: {
          entitiesCount: result.entities.length,
          relationshipsCount: result.relationships.length,
          sourcesCount: result.sources.length,
          entities: result.entities,
          relationships: result.relationships,
          sources: result.sources,
        },
      }
    } catch (error) {
      return {
        success: false,
        output: "Failed to query the knowledge graph.",
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
