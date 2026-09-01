import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  promptFindOne: vi.fn(),
  promptUpdateOne: vi.fn(),
}))

vi.mock("../models/Prompt", () => ({
  default: {
    findOne: (...args: any[]) => {
      mocks.promptFindOne(...args)
      return {
        lean: async () => mocks.promptFindOne()
      }
    },
    updateOne: (...args: any[]) => mocks.promptUpdateOne(...args),
  },
}))

import { getActivePrompt, renderPrompt } from "./prompt.service"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("prompt service", () => {
  it("getActivePrompt retrieves template from DB if active", async () => {
    mocks.promptFindOne.mockResolvedValue({
      name: "rag_answer",
      template: "User question is: {{question}}",
      isActive: true,
    })

    const template = await getActivePrompt("rag_answer")
    expect(template).toBe("User question is: {{question}}")
  })

  it("getActivePrompt falls back to default prompt if DB lookup is empty", async () => {
    mocks.promptFindOne.mockResolvedValue(null)

    const template = await getActivePrompt("rag_answer_no_context")
    expect(template).toContain("You are NeuroStack AI")
    expect(template).toContain("{{question}}")
  })

  it("renderPrompt substitutes placeholders correctly", () => {
    const template = "Hello {{recipient}}, context: {{context}}"
    const rendered = renderPrompt(template, {
      recipient: "Alice",
      context: "meeting at 5",
    })
    expect(rendered).toBe("Hello Alice, context: meeting at 5")
  })

  it("renderPrompt replaces missing variables with empty string", () => {
    const template = "Hello {{recipient}}, missing: {{missing}}"
    const rendered = renderPrompt(template, {
      recipient: "Bob",
    })
    expect(rendered).toBe("Hello Bob, missing: ")
  })
})
