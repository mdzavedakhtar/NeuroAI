import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  providerGenerate: vi.fn(),
}))

// Mock prompt service — prevents MongoDB calls
vi.mock("./prompt.service", () => ({
  getActivePrompt: async () =>
    `Evaluate: question={{question}} context={{context}} answer={{answer}}`,
  renderPrompt: (_: string, vars: Record<string, string>) =>
    `q=${vars.question} c=${vars.context} a=${vars.answer}`,
}))

vi.mock("./llm/llm.registry", () => ({
  getProvider: () => ({
    name: "gemini",
    generate: async (options: any) => mocks.providerGenerate(options),
  }),
}))

import { evaluateRagResponse } from "./rag.evaluator"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("rag evaluator service", () => {
  it("parses valid LLM judge JSON and calculates average score", async () => {
    mocks.providerGenerate.mockResolvedValue({
      text: JSON.stringify({ contextRelevance: 0.9, answerRelevance: 0.8, faithfulness: 1.0 }),
      model: "gemini-mock",
    })

    const scores = await evaluateRagResponse({
      question: "What is NeuroStack?",
      context: "NeuroStack is a RAG platform.",
      answer: "NeuroStack is a document intelligence platform.",
    })

    expect(scores.contextRelevance).toBe(0.9)
    expect(scores.answerRelevance).toBe(0.8)
    expect(scores.faithfulness).toBe(1.0)
    expect(scores.averageScore).toBe(0.9)
  })

  it("returns zero scores gracefully on malformed JSON output", async () => {
    mocks.providerGenerate.mockResolvedValue({
      text: "Sorry, I cannot evaluate this.",
      model: "gemini-mock",
    })

    const scores = await evaluateRagResponse({
      question: "What is NeuroStack?",
      context: "NeuroStack is a platform.",
      answer: "NeuroStack is a platform.",
    })

    expect(scores.contextRelevance).toBe(0)
    expect(scores.answerRelevance).toBe(0)
    expect(scores.faithfulness).toBe(0)
    expect(scores.averageScore).toBe(0)
  })
})
