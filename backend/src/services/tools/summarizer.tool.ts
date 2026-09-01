import type { AiTool, ToolInput, ToolResult, ToolContext } from "./tool.interface"
import { getProvider } from "../llm/llm.registry"
import { getActivePrompt, renderPrompt } from "../prompt.service"

export class SummarizerTool implements AiTool {
  readonly name = "summarizer"
  readonly description = "Summarizes text or document content into a concise structured format"
  readonly inputSchema = {
    text: { type: "string", required: true, description: "The text to summarize" },
    style: { type: "string", required: false, description: "Summary style (e.g. bullet-points, paragraph, executive-brief)" },
  }

  validate(input: ToolInput) {
    const errors: string[] = []
    if (!input.text || typeof input.text !== "string" || !input.text.trim()) {
      errors.push("text is required and must be a non-empty string")
    }
    return { valid: errors.length === 0, errors }
  }

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolResult> {
    const template = await getActivePrompt("summarizer_tool")
    const prompt = renderPrompt(template, {
      text: input.text.trim(),
      style: input.style?.trim() || "structured bullet points",
    })
    const provider = getProvider()
    const response = await provider.generate({ prompt })
    return { success: true, output: response.text, metadata: { model: response.model } }
  }
}
