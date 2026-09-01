import { GoogleGenAI } from "@google/genai"
import type { LLMProvider, LLMGenerateOptions, LLMResponse } from "./llm.provider"

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini"
  readonly defaultModel: string
  private client: GoogleGenAI

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set")
    this.client = new GoogleGenAI({ apiKey })
    this.defaultModel = process.env.GEMINI_MODEL || "gemini-2.0-flash"
  }

  isAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const model = options.model || this.defaultModel
    const response = await this.client.models.generateContent({
      model,
      contents: options.prompt,
    })
    const text = response.text?.trim() ?? ""
    return { text, model }
  }

  async *stream(options: LLMGenerateOptions): AsyncIterable<string> {
    const model = options.model || this.defaultModel
    const responseStream = await this.client.models.generateContentStream({
      model,
      contents: options.prompt,
    })
    for await (const chunk of responseStream) {
      yield chunk.text || ""
    }
  }
}
