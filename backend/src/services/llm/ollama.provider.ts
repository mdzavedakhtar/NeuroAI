/**
 * Ollama Provider — activates only when OLLAMA_BASE_URL is set.
 * Ollama runs locally and exposes an OpenAI-compatible REST API.
 */
import type { LLMProvider, LLMGenerateOptions, LLMResponse } from "./llm.provider"

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama"
  readonly defaultModel = "llama3.2"
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434"
  }

  isAvailable(): boolean {
    return !!process.env.OLLAMA_BASE_URL
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) throw new Error("OLLAMA_BASE_URL is not configured")
    const model = options.model || this.defaultModel
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: options.prompt, stream: false }),
    })
    if (!response.ok) throw new Error(`Ollama API error: ${response.statusText}`)
    const data = await response.json() as { response: string }
    return { text: data.response.trim(), model }
  }

  async *stream(options: LLMGenerateOptions): AsyncIterable<string> {
    if (!this.isAvailable()) throw new Error("OLLAMA_BASE_URL is not configured")
    const model = options.model || this.defaultModel
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: options.prompt, stream: true }),
    })
    if (!response.ok || !response.body) throw new Error(`Ollama API error: ${response.statusText}`)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split("\n").filter(Boolean)
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as { response: string; done: boolean }
          if (parsed.response) yield parsed.response
        } catch { /* skip malformed chunks */ }
      }
    }
  }
}
