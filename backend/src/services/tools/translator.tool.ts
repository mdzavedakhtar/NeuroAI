import type { AiTool, ToolInput, ToolResult, ToolContext } from "./tool.interface"
import { getProvider } from "../llm/llm.registry"
import { getActivePrompt, renderPrompt } from "../prompt.service"

export class TranslatorTool implements AiTool {
  readonly name = "translator"
  readonly description = "Translates text between languages while preserving formatting and tone"
  readonly inputSchema = {
    text: { type: "string", required: true, description: "The text to translate" },
    targetLanguage: { type: "string", required: true, description: "The language to translate to" },
    sourceLanguage: { type: "string", required: false, description: "The language to translate from" },
  }

  validate(input: ToolInput) {
    const errors: string[] = []
    if (!input.text || typeof input.text !== "string" || !input.text.trim()) {
      errors.push("text is required and must be a non-empty string")
    }
    if (!input.targetLanguage || typeof input.targetLanguage !== "string" || !input.targetLanguage.trim()) {
      errors.push("targetLanguage is required and must be a non-empty string")
    }
    return { valid: errors.length === 0, errors }
  }

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolResult> {
    const template = await getActivePrompt("translator_tool")
    const prompt = renderPrompt(template, {
      text: input.text.trim(),
      targetLanguage: input.targetLanguage.trim(),
      sourceLanguage: input.sourceLanguage?.trim() || "auto-detected language",
    })
    const provider = getProvider()
    const response = await provider.generate({ prompt })
    return { success: true, output: response.text, metadata: { model: response.model } }
  }
}
