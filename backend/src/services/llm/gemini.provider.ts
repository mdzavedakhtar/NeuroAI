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
    this.defaultModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"
  }

  isAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY
  }

  private resolveModelCandidates(modelName?: string): string[] {
    const knownMappings: Record<string, string> = {
      "gemini-3.5-flash-lite": "gemini-3.5-flash-lite",
      "gemini-3.8-flash": "gemini-3.8-flash",
      "gemini-2.5-flash": "gemini-2.5-flash",
      "gemini-2.0-flash": "gemini-3.5-flash-lite",
      "Gemini 2.0 Flash": "gemini-3.5-flash-lite",
      "gemini-1.5-flash": "gemini-1.5-flash",
    }
    const primary = (modelName && knownMappings[modelName]) || "gemini-3.5-flash-lite"
    const candidates = [primary, "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash", "gemini-1.5-flash"]
    return Array.from(new Set(candidates))
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const modelsToTry = this.resolveModelCandidates(options.model)
    let lastError: any = null

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await this.client.models.generateContent({
            model,
            contents: options.prompt,
          })
          const text = response.text?.trim() ?? ""
          if (text) return { text, model }
        } catch (err: any) {
          lastError = err
          console.warn(`[GeminiProvider] generate failed on "${model}" (attempt ${attempt}):`, err?.message || err)
          await new Promise((r) => setTimeout(r, 300 * attempt))
        }
      }
    }
    throw lastError || new Error("All Gemini models failed to generate content.")
  }

  async *stream(options: LLMGenerateOptions): AsyncIterable<string> {
    const modelsToTry = this.resolveModelCandidates(options.model)
    let lastError: any = null
    let streamedCount = 0

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const responseStream = await this.client.models.generateContentStream({
            model,
            contents: options.prompt,
          })
          for await (const chunk of responseStream) {
            if (chunk.text) {
              streamedCount++
              yield chunk.text
            }
          }
          if (streamedCount > 0) return
        } catch (err: any) {
          lastError = err
          console.warn(`[GeminiProvider] stream failed on "${model}" (attempt ${attempt}):`, err?.message || err)
          if (streamedCount > 0) throw err
          await new Promise((r) => setTimeout(r, 300 * attempt))
        }
      }
    }

    if (streamedCount === 0) {
      throw lastError || new Error("All Gemini models failed to stream response.")
    }
  }
}
