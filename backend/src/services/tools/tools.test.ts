import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  providerGenerate: vi.fn(),
  searchKnowledge: vi.fn(),
  queryGraph: vi.fn(),
}))

// Mock prompt service so tools never touch MongoDB
vi.mock("../prompt.service", () => ({
  getActivePrompt: async (name: string) => `mock-template-{{input}} for ${name}`,
  renderPrompt: (template: string, vars: Record<string, string>) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? ""),
}))

vi.mock("../llm/llm.registry", () => ({
  getProvider: () => ({
    name: "mock-llm",
    generate: async (options: any) => mocks.providerGenerate(options),
  }),
}))

vi.mock("../pinecone.service", () => ({
  searchKnowledge: async (options: any) => mocks.searchKnowledge(options),
  buildKnowledgeContext: (results: any[]) => results.map((r) => r.content).join("\n"),
}))

vi.mock("../gemini.service", () => ({
  generateRagAnswer: async ({ question }: any) => `Answer to ${question}`,
}))

vi.mock("../graph.query.service", () => ({
  queryGraph: async (options: any) => mocks.queryGraph(options),
}))

import { getTool, listTools } from "./tool.registry"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("modular AI tools workspace", () => {
  it("lists all 10 tools with name and description", () => {
    const list = listTools()
    expect(list.length).toBe(10)
    const names = list.map((t) => t.name)
    expect(names).toContain("summarizer")
    expect(names).toContain("rag-search")
    expect(names).toContain("bug-detector")
    expect(names).toContain("test-generator")
    expect(names).toContain("data-analyzer")
    expect(names).toContain("content-rewriter")
    expect(names).toContain("translator")
    expect(names).toContain("email-composer")
    expect(names).toContain("code-explainer")
    expect(names).toContain("graph-query")
  })

  it("summarizer: rejects empty input and runs with valid input", async () => {
    mocks.providerGenerate.mockResolvedValue({ text: "Summary text", model: "mock" })
    const tool = getTool("summarizer")!
    expect(tool).toBeDefined()

    const v = tool.validate({})
    expect(v.valid).toBe(false)

    const result = await tool.execute({ text: "Long text content to summarize" }, { userId: "user-1" })
    expect(result.success).toBe(true)
    expect(result.output).toBe("Summary text")
  })

  it("rag-search: calls Pinecone and returns grounded answer", async () => {
    mocks.searchKnowledge.mockResolvedValue([
      { id: "c1", content: "AI context info", originalName: "doc1.pdf", score: 0.9, pageNumber: 2 },
    ])
    const tool = getTool("rag-search")!
    const result = await tool.execute({ query: "What is AI?" }, { userId: "user-1", knowledgeId: "k-1" })
    expect(result.success).toBe(true)
    expect(result.output).toContain("What is AI?")
    expect(result.metadata?.chunksFound).toBe(1)
  })

  it("bug-detector: returns analysis for provided code", async () => {
    mocks.providerGenerate.mockResolvedValue({ text: "NullPointer on line 5", model: "mock" })
    const tool = getTool("bug-detector")!
    const result = await tool.execute({ code: "let x = null; x.y;" }, { userId: "user-1" })
    expect(result.success).toBe(true)
    expect(result.output).toBe("NullPointer on line 5")
  })

  it("graph-query: queries Neo4j and returns summary", async () => {
    mocks.queryGraph.mockResolvedValue({
      summary: "Found node React",
      entities: [],
      relationships: [],
      sources: [],
    })
    const tool = getTool("graph-query")!
    const result = await tool.execute({ query: "find React relationships" }, { userId: "user-1" })
    expect(result.success).toBe(true)
    expect(result.output).toBe("Found node React")
  })
})
