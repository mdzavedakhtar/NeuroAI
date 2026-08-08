import fs from "fs"
import { PDFParse } from "pdf-parse"

export interface ProcessedPDF {
  text: string
  chunks: string[]
  characters: number
  pages: number
}

function createChunks(
  text: string,
  chunkSize = 1000,
  overlap = 200
): string[] {
  const chunks: string[] = []

  const cleanedText = text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim()

  if (!cleanedText) {
    return chunks
  }

  let start = 0

  while (start < cleanedText.length) {
    const end = Math.min(
      start + chunkSize,
      cleanedText.length
    )

    const chunk = cleanedText
      .slice(start, end)
      .trim()

    if (chunk) {
      chunks.push(chunk)
    }

    if (end === cleanedText.length) {
      break
    }

    start = Math.max(
      end - overlap,
      start + 1
    )
  }

  return chunks
}

export async function processPDF(
  filePath: string
): Promise<ProcessedPDF> {

  const buffer = fs.readFileSync(filePath)

  const parser = new PDFParse({
    data: buffer,
  })

  try {
    const result = await parser.getText()

    const text = result.text.trim()
    const chunks = createChunks(text)

    return {
      text,
      chunks,
      characters: text.length,
      pages: result.total,
    }
  } finally {
    await parser.destroy()
  }
}