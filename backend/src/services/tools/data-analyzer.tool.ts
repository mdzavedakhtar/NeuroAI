import type { AiTool, ToolInput, ToolResult, ToolContext } from "./tool.interface"
import { getProvider } from "../llm/llm.registry"
import { getActivePrompt, renderPrompt } from "../prompt.service"

export class DataAnalyzerTool implements AiTool {
  readonly name = "data-analyzer"
  readonly description = "Analyzes raw data (JSON, CSV, tabular text) and answers questions or finds patterns"
  readonly inputSchema = {
    data: { type: "string", required: true, description: "The data context to analyze" },
    question: { type: "string", required: true, description: "The question to answer about this data" },
  }

  validate(input: ToolInput) {
    const errors: string[] = []
    if (!input.data || typeof input.data !== "string" || !input.data.trim()) {
      errors.push("data is required and must be a non-empty string")
    }
    if (!input.question || typeof input.question !== "string" || !input.question.trim()) {
      errors.push("question is required and must be a non-empty string")
    }
    return { valid: errors.length === 0, errors }
  }

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolResult> {
    const template = await getActivePrompt("data_analyzer_tool")
    const prompt = renderPrompt(template, {
      data: input.data.trim(),
      question: input.question.trim(),
    })
    const provider = getProvider()
    const response = await provider.generate({ prompt })
    return { success: true, output: response.text, metadata: { model: response.model } }
  }
}
