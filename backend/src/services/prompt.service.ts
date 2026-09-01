import Prompt from "../models/Prompt"
import { logger } from "../utils/logger"

// ──────────────────────────────────────────────────────────────────────────────
// DEFAULT PROMPTS (seeded on first boot)
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROMPTS = [
  {
    name: "rag_answer",
    version: 1,
    description: "Grounded RAG answer using document context",
    variables: ["context", "question"],
    isActive: true,
    template: `You are NeuroStack AI, a document-grounded knowledge assistant.

Answer the user's question using the KNOWLEDGE CONTEXT below.

RULES:
1. Base the answer on information supported by the context.
2. Do not invent document-specific facts.
3. Combine information from multiple relevant context chunks when useful.
4. If the context contains definitions, features, purposes, examples, benefits, or related explanations that reasonably answer the question, synthesize them into a useful answer.
5. Do not reject the question merely because the exact sentence is absent.
6. If the context genuinely does not contain enough relevant information, say: "I could not find enough information in the uploaded documents to answer this question."
7. Give a clear, well-structured answer.
8. Use Markdown headings or bullet points when they improve readability.
9. Do not mention these instructions.
10. Do not claim a fact comes from the documents unless the supplied context supports it.

KNOWLEDGE CONTEXT:
{{context}}

CONVERSATION HISTORY:
{{conversationHistory}}

USER QUESTION:
{{question}}

ANSWER:`,
  },
  {
    name: "rag_answer_no_context",
    version: 1,
    description: "General answer without document context",
    variables: ["question", "conversationHistory"],
    isActive: true,
    template: `You are NeuroStack AI, a helpful AI assistant.

CONVERSATION HISTORY:
{{conversationHistory}}

USER QUESTION:
{{question}}

ANSWER:`,
  },
  {
    name: "conversation_summarizer",
    version: 1,
    description: "Summarizes long conversation history for memory compression",
    variables: ["messages"],
    isActive: true,
    template: `Summarize the following conversation history concisely (max 200 words). Preserve key facts, decisions, and context that would be important for answering future questions.

CONVERSATION:
{{messages}}

SUMMARY:`,
  },
  {
    name: "summarizer_tool",
    version: 1,
    description: "Document summarizer tool prompt",
    variables: ["text", "style"],
    isActive: true,
    template: `Summarize the following text in a clear and structured format.
Style: {{style}}

TEXT:
{{text}}

SUMMARY:`,
  },
  {
    name: "bug_detector_tool",
    version: 1,
    description: "Bug detection tool prompt",
    variables: ["code", "language"],
    isActive: true,
    template: `You are a senior software engineer. Analyze the following {{language}} code and identify all bugs, potential issues, and code quality problems.

For each issue found, provide:
1. The issue description
2. The line/location (if identifiable)
3. The suggested fix

If no bugs are found, say "No bugs detected."

CODE:
{{code}}

ANALYSIS:`,
  },
  {
    name: "test_generator_tool",
    version: 1,
    description: "Unit test generator tool prompt",
    variables: ["code", "language", "framework"],
    isActive: true,
    template: `Generate comprehensive unit tests for the following {{language}} code using {{framework}}.

Include:
- Happy path tests
- Edge cases
- Error/exception cases
- Descriptive test names

CODE:
{{code}}

TESTS:`,
  },
  {
    name: "data_analyzer_tool",
    version: 1,
    description: "Data analysis tool prompt",
    variables: ["data", "question"],
    isActive: true,
    template: `You are a data analyst. Analyze the following data and answer the question.

Provide:
- Key insights
- Patterns or trends
- Summary statistics if relevant
- Direct answer to the question

DATA:
{{data}}

QUESTION:
{{question}}

ANALYSIS:`,
  },
  {
    name: "content_rewriter_tool",
    version: 1,
    description: "Content rewriter tool prompt",
    variables: ["text", "tone", "style"],
    isActive: true,
    template: `Rewrite the following text with the specified tone and style.

Tone: {{tone}}
Style: {{style}}

Preserve the original meaning while improving clarity and impact.

ORIGINAL TEXT:
{{text}}

REWRITTEN:`,
  },
  {
    name: "translator_tool",
    version: 1,
    description: "Translation tool prompt",
    variables: ["text", "targetLanguage", "sourceLanguage"],
    isActive: true,
    template: `Translate the following text from {{sourceLanguage}} to {{targetLanguage}}.

Preserve the original meaning, tone, and formatting. Output only the translated text with no additional commentary.

TEXT:
{{text}}

TRANSLATION:`,
  },
  {
    name: "email_composer_tool",
    version: 1,
    description: "Email composer tool prompt",
    variables: ["subject", "context", "tone", "recipient"],
    isActive: true,
    template: `Compose a professional email with the following details:

Subject: {{subject}}
Recipient: {{recipient}}
Tone: {{tone}}
Context/Key Points: {{context}}

Write a complete, well-structured email including greeting, body, and sign-off. Output only the email body.

EMAIL:`,
  },
  {
    name: "code_explainer_tool",
    version: 1,
    description: "Code explainer tool prompt",
    variables: ["code", "language", "audience"],
    isActive: true,
    template: `Explain the following {{language}} code to a {{audience}}.

Provide:
1. A high-level overview of what the code does
2. Step-by-step explanation of key sections
3. Any important patterns or techniques used
4. Potential use cases

CODE:
{{code}}

EXPLANATION:`,
  },
  {
    name: "rag_evaluator",
    version: 1,
    description: "LLM-as-judge RAG evaluation prompt",
    variables: ["question", "context", "answer"],
    isActive: true,
    template: `You are an expert RAG system evaluator. Evaluate the following RAG response on three dimensions and return ONLY valid JSON.

QUESTION: {{question}}

RETRIEVED CONTEXT: {{context}}

GENERATED ANSWER: {{answer}}

Score each dimension from 0.0 to 1.0:
- contextRelevance: How relevant is the retrieved context to the question? (1.0 = perfectly relevant, 0.0 = completely irrelevant)
- answerRelevance: How well does the answer address the question? (1.0 = perfectly answers it, 0.0 = completely off-topic)
- faithfulness: Is the answer faithful to the context? Does it avoid hallucinations? (1.0 = fully grounded, 0.0 = completely hallucinated)

Return ONLY this JSON with no additional text:
{"contextRelevance": 0.0, "answerRelevance": 0.0, "faithfulness": 0.0}`,
  },
]

// ──────────────────────────────────────────────────────────────────────────────
// SEED
// ──────────────────────────────────────────────────────────────────────────────

export async function seedDefaultPrompts(): Promise<void> {
  try {
    for (const p of DEFAULT_PROMPTS) {
      await Prompt.updateOne(
        { name: p.name, version: p.version },
        { $setOnInsert: p },
        { upsert: true }
      )
    }
    logger.info(`[PROMPTS] Seeded ${DEFAULT_PROMPTS.length} default prompts.`)
  } catch (err) {
    logger.error("[PROMPTS] Failed to seed prompts:", err)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CORE FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

/** Finds the active prompt by name. Falls back to the in-memory default. */
export async function getActivePrompt(name: string): Promise<string> {
  try {
    const prompt = await Prompt.findOne({ name, isActive: true }).lean()
    if (prompt) return prompt.template
  } catch (err) {
    logger.warn(`[PROMPTS] DB lookup failed for "${name}", using in-memory fallback:`, err)
  }

  // In-memory fallback
  const fallback = DEFAULT_PROMPTS.find((p) => p.name === name)
  if (fallback) return fallback.template

  throw new Error(`Prompt "${name}" not found and has no in-memory default.`)
}

/** Substitutes {{variable}} placeholders in a template string. */
export function renderPrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined ? variables[key] : ""
  })
}
