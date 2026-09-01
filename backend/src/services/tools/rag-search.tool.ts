import type { AiTool, ToolInput, ToolResult, ToolContext } from "./tool.interface"
import { searchKnowledge, buildKnowledgeContext } from "../pinecone.service"
import { generateRagAnswer } from "../gemini.service"

export class RagSearchTool implements AiTool {
  readonly name = "rag-search"
  readonly description = "Searches your knowledge base using semantic retrieval and returns a grounded AI answer"
  readonly inputSchema = {
    query: { type: "string", required: true, description: "Your question or search query" },
    knowledgeId: { type: "string", required: false, description: "Specific document to search within" },
    topK: { type: "number", required: false, description: "Number of chunks to retrieve (default 8)" },
  }

  validate(input: ToolInput) {
    const errors: string[] = []
    if (!input.query || typeof input.query !== "string" || !input.query.trim()) {
      errors.push("query is required and must be a non-empty string")
    }
    return { valid: errors.length === 0, errors }
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolResult> {
    const results = await searchKnowledge({
      query: input.query.trim(),
      userId: context.userId,
      knowledgeId: input.knowledgeId || context.knowledgeId,
      topK: input.topK || 8,
    })

    const knowledgeContext = buildKnowledgeContext(results)

    if (!knowledgeContext.trim()) {
      return {
        success: true,
        output: "No relevant information found in your knowledge base for this query.",
        metadata: { chunksFound: 0 },
      }
    }

    const answer = await generateRagAnswer({
      question: input.query.trim(),
      context: knowledgeContext,
    })

    const sources = results.map((r, i) => ({
      sourceNumber: i + 1,
      fileName: r.originalName,
      pageNumber: r.pageNumber,
      score: r.score,
    }))

    return {
      success: true,
      output: answer,
      metadata: { chunksFound: results.length, sources },
    }
  }
}
