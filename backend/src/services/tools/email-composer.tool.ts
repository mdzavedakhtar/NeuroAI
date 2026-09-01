import type { AiTool, ToolInput, ToolResult, ToolContext } from "./tool.interface"
import { getProvider } from "../llm/llm.registry"
import { getActivePrompt, renderPrompt } from "../prompt.service"

export class EmailComposerTool implements AiTool {
  readonly name = "email-composer"
  readonly description = "Drafts a polished email tailored to recipient, subject, and tone"
  readonly inputSchema = {
    subject: { type: "string", required: true, description: "Email subject line" },
    context: { type: "string", required: true, description: "Main topics, updates, or request of the email" },
    recipient: { type: "string", required: false, description: "Name/title of the email recipient" },
    tone: { type: "string", required: false, description: "Tone of email (e.g. professional, friendly, formal, concise)" },
  }

  validate(input: ToolInput) {
    const errors: string[] = []
    if (!input.subject || typeof input.subject !== "string" || !input.subject.trim()) {
      errors.push("subject is required and must be a non-empty string")
    }
    if (!input.context || typeof input.context !== "string" || !input.context.trim()) {
      errors.push("context is required and must be a non-empty string")
    }
    return { valid: errors.length === 0, errors }
  }

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolResult> {
    const template = await getActivePrompt("email_composer_tool")
    const prompt = renderPrompt(template, {
      subject: input.subject.trim(),
      context: input.context.trim(),
      recipient: input.recipient?.trim() || "Recipient",
      tone: input.tone?.trim() || "professional",
    })
    const provider = getProvider()
    const response = await provider.generate({ prompt })
    return { success: true, output: response.text, metadata: { model: response.model } }
  }
}
