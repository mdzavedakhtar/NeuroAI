import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import AdmZip from "adm-zip"
import fs from "fs"
import os from "os"
import path from "path"
import { createChunks, processXLSX, processPPTX } from "./document.service"

describe("createChunks", () => {
  it("returns an empty array for empty text", () => {
    expect(createChunks("")).toEqual([])
    expect(createChunks("   \n\n  ")).toEqual([])
  })

  it("returns a single chunk for short text", () => {
    const chunks = createChunks("Hello world")
    expect(chunks).toEqual(["Hello world"])
  })

  it("splits long text into chunks of at most chunkSize characters", () => {
    const text = "a".repeat(2500)
    const chunks = createChunks(text, 1000, 200)

    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(1000)
    })
  })

  it("maintains overlap between consecutive chunks", () => {
    const text = "The quick brown fox jumps over the lazy dog. ".repeat(30)
    const chunks = createChunks(text, 100, 40)

    expect(chunks.length).toBeGreaterThan(1)

    // Every consecutive pair must share the configured overlap region.
    for (let i = 0; i < chunks.length - 1; i++) {
      const current = chunks[i]
      const next = chunks[i + 1]

      const overlapSample = current.slice(-40)
      expect(next.includes(overlapSample)).toBe(true)
    }
  })

  it("cleans excessive whitespace and newlines", () => {
    const chunks = createChunks("line1\n\n\n\nline2\n\n\nline3    spaced")
    expect(chunks[0]).toBe("line1\n\nline2\n\nline3 spaced")
  })
})

describe("processXLSX", () => {
  it("extracts each sheet into chunks with sheet headers", async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Name", "Role"],
        ["Alice", "Engineer"],
        ["Bob", "Designer"],
      ]),
      "People"
    )

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "neurostack-test-"))
    const filePath = path.join(dir, "test.xlsx")
    XLSX.writeFile(workbook, filePath)

    try {
      const result = await processXLSX(filePath)

      expect(result.fileType).toBe("xlsx")
      expect(result.pages).toBe(1)
      expect(result.text).toContain("People")
      expect(result.text).toContain("Alice")

      const joined = result.chunks.join("\n")
      expect(joined).toContain("=== Sheet: People ===")
      expect(joined).toContain("Engineer")
      expect(result.characters).toBeGreaterThan(0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Minimal PPTX fixture builder
// A PPTX file is a ZIP archive containing:
//   ppt/slides/slide1.xml, ppt/slides/slide2.xml, ...
// ──────────────────────────────────────────────────────────────────────────────

function buildPptxFixture(slides: { slideNumber: number; texts: string[] }[]): string {
  const zip = new AdmZip()

  const slideXml = (texts: string[]) => {
    const paragraphs = texts
      .map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`)
      .join("")
    return `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>${paragraphs}</p:spTree></p:cSld>
</p:sld>`
  }

  for (const slide of slides) {
    zip.addFile(
      `ppt/slides/slide${slide.slideNumber}.xml`,
      Buffer.from(slideXml(slide.texts), "utf8")
    )
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "neurostack-pptx-"))
  const filePath = path.join(dir, "test.pptx")
  zip.writeZip(filePath)
  return filePath
}

describe("processPPTX", () => {
  it("extracts text slide-by-slide", async () => {
    const filePath = buildPptxFixture([
      { slideNumber: 1, texts: ["Introduction", "Welcome to NeuroStack"] },
      { slideNumber: 2, texts: ["Architecture", "MongoDB + Pinecone + Neo4j"] },
    ])

    try {
      const result = await processPPTX(filePath)

      expect(result.fileType).toBe("pptx")
      expect(result.pages).toBe(2)
      expect(result.text).toContain("Introduction")
      expect(result.text).toContain("Welcome to NeuroStack")
      expect(result.text).toContain("Architecture")
      expect(result.text).toContain("MongoDB + Pinecone + Neo4j")
      expect(result.characters).toBeGreaterThan(0)

      // Verify slide headers in chunks
      const joined = result.chunks.join("\n")
      expect(joined).toContain("=== Slide: 1 ===")
      expect(joined).toContain("=== Slide: 2 ===")
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true })
    }
  })

  it("sorts slides numerically (slide10 after slide9, not after slide1)", async () => {
    const filePath = buildPptxFixture([
      { slideNumber: 9,  texts: ["Slide Nine"] },
      { slideNumber: 10, texts: ["Slide Ten"] },
      { slideNumber: 1,  texts: ["Slide One"] },
    ])

    try {
      const result = await processPPTX(filePath)
      // Confirm slide 1 appears before slide 9 and slide 9 before slide 10
      const idx1  = result.text.indexOf("=== Slide: 1 ===")
      const idx9  = result.text.indexOf("=== Slide: 9 ===")
      const idx10 = result.text.indexOf("=== Slide: 10 ===")
      expect(idx1).toBeLessThan(idx9)
      expect(idx9).toBeLessThan(idx10)
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true })
    }
  })

  it("returns empty text and empty chunks for a PPTX with no text content", async () => {
    const filePath = buildPptxFixture([
      { slideNumber: 1, texts: [] },
    ])

    try {
      const result = await processPPTX(filePath)
      expect(result.text).toBe("")
      expect(result.chunks).toHaveLength(0)
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true })
    }
  })

  it("decodes XML entities in slide text", async () => {
    const filePath = buildPptxFixture([
      { slideNumber: 1, texts: ["R&amp;D", "AI &amp; ML", "&lt;Node.js&gt;"] },
    ])

    try {
      const result = await processPPTX(filePath)
      expect(result.text).toContain("R&D")
      expect(result.text).toContain("AI & ML")
      expect(result.text).toContain("<Node.js>")
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true })
    }
  })
})
