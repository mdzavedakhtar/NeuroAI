import fs from "fs"
import mammoth from "mammoth"
import * as XLSX from "xlsx"
import { PDFParse } from "pdf-parse"

export interface ProcessedDocument {
  text: string
  chunks: string[]
  characters: number
  pages: number
  fileType: string
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

    const text = result.text.trim()
    const chunks = createChunks(text)

    return {
      text,
      chunks,
      characters: text.length,
      pages: result.total,
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

  return {
    text,
    chunks,
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

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    if (csv.trim()) {
      fullText += `\n\n=== Sheet: ${sheetName} ===\n${csv}`
    }
  })

  const text = fullText.trim()
  const chunks = createChunks(text)

  return {
    text,
    chunks,
    characters: text.length,
    pages: workbook.SheetNames.length,
    fileType: "xlsx",
  }
}

// ======================================================
// PPTX (basic text extraction via XLSX utility)
// ======================================================

export async function processPPTX(
  filePath: string
): Promise<ProcessedDocument> {
  // PPTX is a ZIP file; use XLSX to extract slide text
  const workbook = XLSX.readFile(filePath)

  let fullText = ""

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const text = XLSX.utils.sheet_to_txt(sheet)
    if (text.trim()) {
      fullText += `\n\n=== Slide: ${sheetName} ===\n${text}`
    }
  })

  const text = fullText.trim()
  const chunks = createChunks(text)

  return {
    text,
    chunks,
    characters: text.length,
    pages: workbook.SheetNames.length,
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
  if (mimeType === "application/pdf") {
    return processPDF(filePath)
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return processDOCX(filePath)
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return processXLSX(filePath)
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return processPPTX(filePath)
  }

  throw new Error(`Unsupported file type: ${mimeType}`)
}
