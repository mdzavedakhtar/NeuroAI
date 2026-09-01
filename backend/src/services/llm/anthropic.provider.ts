import type { LLMProvider, LLMGenerateOptions, LLMResponse } from "./llm.provider"

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic"
  readonly defaultModel = "claude-3-5-haiku-20241022"

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) throw new Error("ANTHROPIC_API_KEY is not configured")
    // @ts-ignore
    const Anthropic = await import("@anthropic-ai/sdk").catch(() => {
      throw new Error("@anthropic-ai/sdk not installed. Run: npm install @anthropic-ai/sdk")
    })
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })
    const model = options.model || this.defaultModel
    const message = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: options.prompt }],
    })
    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const tokensUsed = (message.usage.input_tokens ?? 0) + (message.usage.output_tokens ?? 0)
    return { text, model, tokensUsed }
  }

  async *stream(options: LLMGenerateOptions): AsyncIterable<string> {
    if (!this.isAvailable()) throw new Error("ANTHROPIC_API_KEY is not configured")
    // @ts-ignore
    const Anthropic = await import("@anthropic-ai/sdk").catch(() => {
      throw new Error("@anthropic-ai/sdk not installed. Run: npm install @anthropic-ai/sdk")
    })
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })
    const model = options.model || this.defaultModel
    const stream = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: options.prompt }],
      stream: true,
    })
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text
      }
    }
  }
}
