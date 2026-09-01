import type { AiTool, ToolInput, ToolResult, ToolContext } from "./tool.interface"
import { getProvider } from "../llm/llm.registry"
import { getActivePrompt, renderPrompt } from "../prompt.service"

export class TestGeneratorTool implements AiTool {
  readonly name = "test-generator"
  readonly description = "Generates comprehensive unit tests for provided source code"
  readonly inputSchema = {
    code: { type: "string", required: true, description: "The source code to test" },
    language: { type: "string", required: false, description: "Programming language of the code" },
    framework: { type: "string", required: false, description: "Testing framework to use (e.g. Jest, Vitest, JUnit)" },
  }

  validate(input: ToolInput) {
    const errors: string[] = []
    if (!input.code || typeof input.code !== "string" || !input.code.trim()) {
      errors.push("code is required and must be a non-empty string")
    }
    return { valid: errors.length === 0, errors }
  }

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolResult> {
    const template = await getActivePrompt("test_generator_tool")
    const prompt = renderPrompt(template, {
      code: input.code.trim(),
      language: input.language?.trim() || "any programming language",
      framework: input.framework?.trim() || "recommended standard testing framework",
    })
    const provider = getProvider()
    const response = await provider.generate({ prompt })
    return { success: true, output: response.text, metadata: { model: response.model } }
  }
}
