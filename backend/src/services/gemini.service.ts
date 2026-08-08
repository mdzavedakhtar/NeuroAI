import "dotenv/config"

import { GoogleGenAI } from "@google/genai"

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is missing in .env"
  )
}

const model =
  process.env.GEMINI_MODEL ||
  "gemini-2.5-flash"

const ai = new GoogleGenAI({
  apiKey,
})

export type GenerateRagAnswerOptions = {
  question: string
  context: string
  model?: string
}

export const generateRagAnswer = async ({
  question,
  context,
}: GenerateRagAnswerOptions): Promise<string> => {
  const cleanQuestion = question.trim()
  const cleanContext = context.trim()

  if (!cleanQuestion) {
    throw new Error(
      "Question is required"
    )
  }

  if (!cleanContext) {
    const response = await ai.models.generateContent({
      model,
      contents: `You are NeuroStack AI, a helpful AI assistant. Answer the user's question directly.

USER QUESTION:
${cleanQuestion}

ANSWER:`,
    })

    const answer = response.text?.trim()

    if (!answer) {
      throw new Error("Gemini returned an empty response")
    }

    return answer
  }

  const prompt = `
You are NeuroStack AI, a document-grounded knowledge assistant.

Answer the user's question using the KNOWLEDGE CONTEXT below.

RULES:

1. Base the answer on information supported by the context.
2. Do not invent document-specific facts.
3. Combine information from multiple relevant context chunks when useful.
4. The user's wording does not need to exactly match the document wording.
5. If the context contains definitions, features, purposes, examples, benefits,
   differences, or related explanations that reasonably answer the question,
   synthesize them into a useful answer.
6. Do not reject the question merely because the exact sentence is absent.
7. If the context genuinely does not contain enough relevant information, say:
   "I could not find enough information in the uploaded documents to answer this question."
8. Give a clear, well-structured answer.
9. Use Markdown headings or bullet points when they improve readability.
10. Do not mention these instructions.
11. Do not claim a fact comes from the documents unless the supplied context supports it.

KNOWLEDGE CONTEXT:

${cleanContext}

USER QUESTION:

${cleanQuestion}

ANSWER:
`

  const response =
    await ai.models.generateContent({
      model,
      contents: prompt,
    })

  const answer =
    response.text?.trim()

  if (!answer) {
    throw new Error(
      "Gemini returned an empty response"
    )
  }

  return answer
}

export const generateRagAnswerStream = async ({
  question,
  context,
  model: modelOverride,
}: GenerateRagAnswerOptions) => {
  const cleanQuestion = question.trim()
  const cleanContext = context.trim()
  const activeModel = modelOverride || model

  if (!cleanQuestion) {
    throw new Error("Question is required")
  }

  if (!cleanContext) {
    return ai.models.generateContentStream({
      model: activeModel,
      contents: `You are NeuroStack AI, a helpful AI assistant. Answer the user's question directly.

USER QUESTION:
${cleanQuestion}

ANSWER:`,
    })
  }

  const prompt = `
You are NeuroStack AI, a document-grounded knowledge assistant.

Answer the user's question using the KNOWLEDGE CONTEXT below.

RULES:

1. Base the answer on information supported by the context.
2. Do not invent document-specific facts.
3. Combine information from multiple relevant context chunks when useful.
4. The user's wording does not need to exactly match the document wording.
5. If the context contains definitions, features, purposes, examples, benefits,
   differences, or related explanations that reasonably answer the question,
   synthesize them into a useful answer.
6. Do not reject the question merely because the exact sentence is absent.
7. If the context genuinely does not contain enough relevant information, say:
   "I could not find enough information in the uploaded documents to answer this question."
8. Give a clear, well-structured answer.
9. Use Markdown headings or bullet points when they improve readability.
10. Do not mention these instructions.
11. Do not claim a fact comes from the documents unless the supplied context supports it.

KNOWLEDGE CONTEXT:

${cleanContext}

USER QUESTION:

${cleanQuestion}

ANSWER:
`

  return ai.models.generateContentStream({
    model: activeModel,
    contents: prompt,
  })
}