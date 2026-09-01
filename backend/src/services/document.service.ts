import fs from "fs"
import mammoth from "mammoth"
import * as XLSX from "xlsx"
import { PDFParse } from "pdf-parse"
import { parsePptx } from "./pptx.parser"

export interface ProcessedDocument {
  text: string
  chunks: string[]
  chunkPageNumbers: number[]
  characters: number
  pages: number
  fileType: string
}

export function createChunks(
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

// ======================================================
// PDF
// ======================================================

export async function processPDF(
  filePath: string
): Promise<ProcessedDocument> {
  const buffer = fs.readFileSync(filePath)

  const parser = new PDFParse({
    data: buffer,
  })

  try {
    const result = await parser.getText()
    const text = (result.text || "").trim()

    const chunks: string[] = []
    const chunkPageNumbers: number[] = []

    if (Array.isArray(result.pages) && result.pages.length > 0) {
      result.pages.forEach((page: any) => {
        const pageText = (page.text || "").trim()
        if (!pageText) return

        const pageChunks = createChunks(pageText)
        pageChunks.forEach((chunk) => {
          chunks.push(chunk)
          chunkPageNumbers.push(page.num || 1)
        })
      });
    } else {
      // Fallback if pages structure is unexpected
      const rawChunks = createChunks(text)
      rawChunks.forEach((chunk) => {
        chunks.push(chunk)
        chunkPageNumbers.push(1)
      })
    }

    // In case no text/chunks were extracted from pages but document isn't empty
    if (chunks.length === 0 && text) {
      const rawChunks = createChunks(text)
      rawChunks.forEach((chunk) => {
        chunks.push(chunk)
        chunkPageNumbers.push(1)
      })
    }

    return {
      text,
      chunks,
      chunkPageNumbers,
      characters: text.length,
      pages: result.total || 1,
      fileType: "pdf",
    }
  } finally {
    await parser.destroy()
  }
}

// ======================================================
// DOCX
// ======================================================

export async function processDOCX(
  filePath: string
): Promise<ProcessedDocument> {
  const buffer = fs.readFileSync(filePath)

  const result = await mammoth.extractRawText({ buffer })
  const text = result.value.trim()
  const chunks = createChunks(text)

  // Generate page estimates based on chunk progress
  const chunkPageNumbers = chunks.map((_, index) => {
    // Standard page is ~3000 characters. Each chunk is ~1000 characters.
    return Math.max(1, Math.ceil(((index * 800) + 1) / 3000))
  })

  return {
    text,
    chunks,
    chunkPageNumbers,
    characters: text.length,
    pages: Math.max(1, Math.ceil(text.length / 3000)),
    fileType: "docx",
  }
}

// ======================================================
// XLSX
// ======================================================

export async function processXLSX(
  filePath: string
): Promise<ProcessedDocument> {
  const workbook = XLSX.readFile(filePath)

  let fullText = ""
  const chunks: string[] = []
  const chunkPageNumbers: number[] = []

  workbook.SheetNames.forEach((sheetName, index) => {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim()
    
    if (csv) {
      const header = `=== Sheet: ${sheetName} ===\n`
      fullText += `\n\n${header}${csv}`

      const sheetChunks = createChunks(csv)
      sheetChunks.forEach((chunk) => {
        chunks.push(`${header}${chunk}`)
        chunkPageNumbers.push(index + 1) // Sheet index starting from 1
      })
    }
  })

  const text = fullText.trim()

  return {
    text,
    chunks,
    chunkPageNumbers,
    characters: text.length,
    pages: workbook.SheetNames.length || 1,
    fileType: "xlsx",
  }
}

// ======================================================
// PPTX
// ======================================================

export async function processPPTX(
  filePath: string
): Promise<ProcessedDocument> {
  const slides = await parsePptx(filePath)

  let fullText = ""
  const chunks: string[] = []
  const chunkPageNumbers: number[] = []

  slides.forEach((slide) => {
    const slideText = slide.text.trim()
    
    if (slideText) {
      const header = `=== Slide: ${slide.slideNumber} ===\n`
      fullText += `\n\n${header}${slideText}`

      const slideChunks = createChunks(slideText)
      slideChunks.forEach((chunk) => {
        chunks.push(`${header}${chunk}`)
        chunkPageNumbers.push(slide.slideNumber)
      })
    }
  })

  const text = fullText.trim()

  return {
    text,
    chunks,
    chunkPageNumbers,
    characters: text.length,
    pages: slides.length || 1,
    fileType: "pptx",
  }
}

// ======================================================
// UNIFIED PROCESSOR
// ======================================================

export async function processDocument(
  filePath: string,
  mimeType: string
): Promise<ProcessedDocument> {
  console.log(`[INGESTION] Processing document file: ${filePath} (${mimeType})`)
  
  let processed: ProcessedDocument
  if (mimeType === "application/pdf") {
    processed = await processPDF(filePath)
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    processed = await processDOCX(filePath)
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    processed = await processXLSX(filePath)
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    processed = await processPPTX(filePath)
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  console.log(`[INGESTION] Document processing completed. Type: ${processed.fileType}, Chunks: ${processed.chunks.length}, Characters: ${processed.characters}`)
  return processed
}
