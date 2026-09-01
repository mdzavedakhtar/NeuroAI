import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock GeminiProvider so the registry doesn't need a real GEMINI_API_KEY
vi.mock("./gemini.provider", () => ({
  GeminiProvider: class {
    name = "gemini"
    defaultModel = "gemini-mock"
    isAvailable() { return true }
    async generate() { return { text: "mock", model: "gemini-mock" } }
    async *stream() { yield "mock" }
  },
}))

vi.mock("./openai.provider", () => ({
  OpenAIProvider: class {
    name = "openai"
    defaultModel = "gpt-4o-mini"
    isAvailable() { return false }
    async generate() { return { text: "", model: "" } }
    async *stream() { yield "" }
  },
}))

vi.mock("./anthropic.provider", () => ({
  AnthropicProvider: class {
    name = "anthropic"
    defaultModel = "claude-3-5-haiku"
    isAvailable() { return false }
    async generate() { return { text: "", model: "" } }
    async *stream() { yield "" }
  },
}))

vi.mock("./ollama.provider", () => ({
  OllamaProvider: class {
    name = "ollama"
    defaultModel = "llama3.2"
    isAvailable() { return false }
    async generate() { return { text: "", model: "" } }
    async *stream() { yield "" }
  },
}))

// Must mock logger because registry is in services/llm/ and logger is at utils/logger
vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { getProvider, listProviders } from "./llm.registry"

describe("llm registry", () => {
  it("lists active providers (at minimum gemini)", () => {
    const list = listProviders()
    expect(list).toContain("gemini")
  })

  it("returns Gemini as default provider", () => {
    const provider = getProvider()
    expect(provider.name).toBe("gemini")
  })

  it("falls back to Gemini when unknown provider requested", () => {
    const provider = getProvider("totally-unknown-ai")
    expect(provider.name).toBe("gemini")
  })
})
