import type { AiTool, ToolInput, ToolResult, ToolContext } from "./tool.interface"
import { getProvider } from "../llm/llm.registry"
import { getActivePrompt, renderPrompt } from "../prompt.service"

export class ContentRewriterTool implements AiTool {
  readonly name = "content-rewriter"
  readonly description = "Rewrites content adjusting its tone, structure, and style"
  readonly inputSchema = {
    text: { type: "string", required: true, description: "The content to rewrite" },
    tone: { type: "string", required: false, description: "Desired tone (e.g. professional, casual, enthusiastic)" },
    style: { type: "string", required: false, description: "Formatting or style constraint" },
  }

  validate(input: ToolInput) {
    const errors: string[] = []
    if (!input.text || typeof input.text !== "string" || !input.text.trim()) {
      errors.push("text is required and must be a non-empty string")
    }
    return { valid: errors.length === 0, errors }
  }

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolResult> {
    const template = await getActivePrompt("content_rewriter_tool")
    const prompt = renderPrompt(template, {
      text: input.text.trim(),
      tone: input.tone?.trim() || "professional",
      style: input.style?.trim() || "rephrased clearly",
    })
    const provider = getProvider()
    const response = await provider.generate({ prompt })
    return { success: true, output: response.text, metadata: { model: response.model } }
  }
}
