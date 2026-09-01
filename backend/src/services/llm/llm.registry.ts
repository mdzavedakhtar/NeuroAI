import type { LLMProvider } from "./llm.provider"
import { GeminiProvider } from "./gemini.provider"
import { OpenAIProvider } from "./openai.provider"
import { AnthropicProvider } from "./anthropic.provider"
import { OllamaProvider } from "./ollama.provider"
import { logger } from "../../utils/logger"

// ──────────────────────────────────────────────────────────────────────────────
// Registry: instantiate once, reuse across requests
// ──────────────────────────────────────────────────────────────────────────────

const providers: Map<string, LLMProvider> = new Map()

function initProviders(): void {
  const gemini = new GeminiProvider()
  providers.set(gemini.name, gemini)

  const openai = new OpenAIProvider()
  if (openai.isAvailable()) {
    providers.set(openai.name, openai)
    logger.info("[LLM_REGISTRY] OpenAI provider registered.")
  }

  const anthropic = new AnthropicProvider()
  if (anthropic.isAvailable()) {
    providers.set(anthropic.name, anthropic)
    logger.info("[LLM_REGISTRY] Anthropic provider registered.")
  }

  const ollama = new OllamaProvider()
  if (ollama.isAvailable()) {
    providers.set(ollama.name, ollama)
    logger.info("[LLM_REGISTRY] Ollama provider registered.")
  }

  logger.info(`[LLM_REGISTRY] Initialized. Active providers: [${[...providers.keys()].join(", ")}]`)
}

// Lazy-init on first call
let initialized = false
function ensureInit(): void {
  if (!initialized) {
    initProviders()
    initialized = true
  }
}

/**
 * Returns the requested provider by name, or the default (Gemini).
 * Always falls back to Gemini if the requested provider is unavailable.
 */
export function getProvider(name?: string): LLMProvider {
  ensureInit()

  const target = name?.toLowerCase() || process.env.LLM_PROVIDER?.toLowerCase() || "gemini"
  const provider = providers.get(target)

  if (provider) return provider

  logger.warn(`[LLM_REGISTRY] Provider "${target}" not found or unavailable. Falling back to Gemini.`)
  return providers.get("gemini")!
}

export function listProviders(): string[] {
  ensureInit()
  return [...providers.keys()]
}
