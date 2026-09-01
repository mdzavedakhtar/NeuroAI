import type { LLMProvider, LLMGenerateOptions, LLMResponse } from "./llm.provider"

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai"
  readonly defaultModel = "gpt-4o-mini"

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) throw new Error("OPENAI_API_KEY is not configured")
    // @ts-ignore
    const { default: OpenAI } = await import("openai").catch(() => {
      throw new Error("openai package not installed. Run: npm install openai")
    })
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const model = options.model || this.defaultModel
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: options.prompt }],
    })
    const text = completion.choices[0]?.message?.content?.trim() ?? ""
    const tokensUsed = completion.usage?.total_tokens
    return { text, model, tokensUsed }
  }

  async *stream(options: LLMGenerateOptions): AsyncIterable<string> {
    if (!this.isAvailable()) throw new Error("OPENAI_API_KEY is not configured")
    // @ts-ignore
    const { default: OpenAI } = await import("openai").catch(() => {
      throw new Error("openai package not installed. Run: npm install openai")
    })
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const model = options.model || this.defaultModel
    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: options.prompt }],
      stream: true,
    })
    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content || ""
    }
  }
}
