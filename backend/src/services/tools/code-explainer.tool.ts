import type { AiTool, ToolInput, ToolResult, ToolContext } from "./tool.interface"
import { getProvider } from "../llm/llm.registry"
import { getActivePrompt, renderPrompt } from "../prompt.service"

export class CodeExplainerTool implements AiTool {
  readonly name = "code-explainer"
  readonly description = "Explains provided code segment clearly for target developer audience levels"
  readonly inputSchema = {
    code: { type: "string", required: true, description: "The source code to explain" },
    language: { type: "string", required: false, description: "Programming language of the code" },
    audience: { type: "string", required: false, description: "Audience technical level (e.g. junior developer, non-technical manager)" },
  }

  validate(input: ToolInput) {
    const errors: string[] = []
    if (!input.code || typeof input.code !== "string" || !input.code.trim()) {
      errors.push("code is required and must be a non-empty string")
    }
    return { valid: errors.length === 0, errors }
  }

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolResult> {
    const template = await getActivePrompt("code_explainer_tool")
    const prompt = renderPrompt(template, {
      code: input.code.trim(),
      language: input.language?.trim() || "any programming language",
      audience: input.audience?.trim() || "developer",
    })
    const provider = getProvider()
    const response = await provider.generate({ prompt })
    return { success: true, output: response.text, metadata: { model: response.model } }
  }
}
