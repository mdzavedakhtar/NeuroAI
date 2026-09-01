import type { AiTool, ToolInput, ToolResult, ToolContext } from "./tool.interface"
import { getProvider } from "../llm/llm.registry"
import { getActivePrompt, renderPrompt } from "../prompt.service"

export class BugDetectorTool implements AiTool {
  readonly name = "bug-detector"
  readonly description = "Analyzes source code to detect bugs, logic errors, and security issues"
  readonly inputSchema = {
    code: { type: "string", required: true, description: "The source code to analyze" },
    language: { type: "string", required: false, description: "Programming language of the code" },
  }

  validate(input: ToolInput) {
    const errors: string[] = []
    if (!input.code || typeof input.code !== "string" || !input.code.trim()) {
      errors.push("code is required and must be a non-empty string")
    }
    return { valid: errors.length === 0, errors }
  }

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolResult> {
    const template = await getActivePrompt("bug_detector_tool")
    const prompt = renderPrompt(template, {
      code: input.code.trim(),
      language: input.language?.trim() || "any programming language",
    })
    const provider = getProvider()
    const response = await provider.generate({ prompt })
    return { success: true, output: response.text, metadata: { model: response.model } }
  }
}
