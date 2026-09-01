import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  messageFind: vi.fn(),
  providerGenerate: vi.fn(),
}))

vi.mock("../models/Message", () => ({
  default: {
    find: (_filter: any) => ({
      sort: () => ({
        select: () => ({
          lean: async () => mocks.messageFind(),
        }),
      }),
    }),
  },
}))

// Mock prompt service — prevents MongoDB access in conversation summarizer
vi.mock("./prompt.service", () => ({
  getActivePrompt: async () => `Summarize: {{messages}}`,
  renderPrompt: (_: string, vars: Record<string, string>) => `SUMMARY_PROMPT:${vars.messages}`,
}))

vi.mock("./llm/llm.registry", () => ({
  getProvider: () => ({
    name: "gemini",
    generate: async (options: any) => mocks.providerGenerate(options),
  }),
}))

import { buildMemoryContext } from "./memory.service"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("conversation memory service", () => {
  it("returns fallback message when conversation is empty", async () => {
    mocks.messageFind.mockResolvedValue([])

    const ctx = await buildMemoryContext("conv-1", "user-1")
    expect(ctx.conversationHistory).toBe("No prior conversation.")
    expect(ctx.messageCount).toBe(0)
    expect(ctx.summarized).toBe(false)
  })

  it("returns verbatim messages when under short-term window (8 messages)", async () => {
    mocks.messageFind.mockResolvedValue([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ])

    const ctx = await buildMemoryContext("conv-1", "user-1")
    expect(ctx.conversationHistory).toContain("User: hello")
    expect(ctx.conversationHistory).toContain("Assistant: hi there")
    expect(ctx.summarized).toBe(false)
  })

  it("triggers summarizer when conversation exceeds threshold (22 messages)", async () => {
    // 22 total → olderMessages = 14, SUMMARIZE_THRESHOLD - WINDOW = 12, 14 >= 12 → summarize
    const mockMessages = Array.from({ length: 22 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg-${i}`,
    }))
    mocks.messageFind.mockResolvedValue(mockMessages)
    mocks.providerGenerate.mockResolvedValue({
      text: "Summarized previous discussion about React",
      model: "gemini-mock",
    })

    const ctx = await buildMemoryContext("conv-1", "user-1")
    expect(ctx.conversationHistory).toContain("Summarized previous discussion about React")
    expect(ctx.conversationHistory).toContain("User: msg-20")
    expect(ctx.summarized).toBe(true)
  })
})
