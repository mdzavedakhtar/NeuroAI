import { Response } from "express"
import fs from "fs/promises"
import path from "path"

import Knowledge from "../models/Knowledge"
import KnowledgeChunk from "../models/KnowledgeChunk"
import { AuthRequest } from "../middleware/auth.middleware"
import { getPineconeIndex } from "../services/pinecone.service"
import { deleteGraphForKnowledge } from "../services/neo4j.service"
import { getCache, setCache, invalidateCache, invalidateCacheByPattern } from "../services/redis.cache.service"

// ======================================================
// MAGIC BYTES VERIFICATION
// Prevents file type spoofing (e.g. renaming .exe to .pdf)
// ======================================================

export async function verifyFileSignature(
  filePath: string,
  extension: string
): Promise<boolean> {
  let fileHandle: Awaited<ReturnType<typeof fs.open>> | null = null
  try {
    fileHandle = await fs.open(filePath, "r")
    const buffer = Buffer.alloc(4)
    await fileHandle.read(buffer, 0, 4, 0)
    const hex = buffer.toString("hex").toUpperCase()

    if (extension === ".pdf") {
      // %PDF
      return hex.startsWith("25504446")
    } else if ([".docx", ".pptx", ".xlsx"].includes(extension)) {
      // PK (ZIP)
      return hex.startsWith("504B")
    }
    return false
  } catch (err) {
    console.error("Error reading file signature:", err)
    return false
  } finally {
    if (fileHandle) {
      await fileHandle.close()
    }
  }
}

// ======================================================
// UPLOAD KNOWLEDGE
// ======================================================

export const uploadKnowledge = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  let uploadedFilePath: string | null = null

  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    if (!req.file) {
      res.status(400).json({ success: false, message: "Please select a file to upload" })
      return
    }

    uploadedFilePath = req.file.path

    // Extension allowlist check
    const extension = path.extname(req.file.originalname).toLowerCase()
    const allowedExtensions = new Set([".pdf", ".docx", ".xlsx", ".pptx"])
    if (!allowedExtensions.has(extension)) {
      await fs.unlink(uploadedFilePath).catch(() => {})
      res.status(400).json({
        success: false,
        message: "Unsupported file extension. Only PDF, DOCX, XLSX, and PPTX files are allowed.",
      })
      return
    }

    // Magic bytes check (prevents spoofed file types)
    const isValid = await verifyFileSignature(uploadedFilePath, extension)
    if (!isValid) {
      await fs.unlink(uploadedFilePath).catch(() => {})
      res.status(400).json({
        success: false,
        message: "Invalid file content. File contents do not match the declared file extension.",
      })
      return
    }

    // Create Knowledge record
    const knowledge = await Knowledge.create({
      user: req.user.id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      status: "uploaded",
      currentStep: "uploaded",
    })

    await invalidateCache(`cache:user:${req.user.id}:sources`)

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully. Call /index to begin processing.",
      knowledge: {
        id: knowledge._id,
        originalName: knowledge.originalName,
        mimeType: knowledge.mimeType,
        size: knowledge.size,
        status: knowledge.status,
        currentStep: knowledge.currentStep,
        fileType: extension.slice(1),
        embeddingStatus: "pending",
        createdAt: knowledge.createdAt,
      },
    })
  } catch (error) {
    console.error("Knowledge upload error:", error)

    // Clean up orphan file if Knowledge record was never created
    if (uploadedFilePath) {
      await fs.unlink(uploadedFilePath).catch(() => {})
    }

    res.status(500).json({
      success: false,
      message: "Unable to upload knowledge",
    })
  }
}

// ======================================================
// GET KNOWLEDGE SOURCES
// ======================================================

export const getKnowledgeSources = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    const cacheKey = `cache:user:${req.user.id}:sources`
    const cached = await getCache<any[]>(cacheKey)
    if (cached) {
      res.status(200).json({
        success: true,
        sources: cached,
      })
      return
    }

    const sources = await Knowledge.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean()

    await setCache(cacheKey, sources, 300)

    res.status(200).json({
      success: true,
      sources,
    })
  } catch (error) {
    console.error("Get knowledge sources error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to load knowledge sources",
    })
  }
}

// ======================================================
// DELETE KNOWLEDGE SOURCE
// Ownership already verified by verifyKnowledgeOwnership middleware.
// req.knowledge is attached and confirmed to belong to req.user.
// ======================================================

export const deleteKnowledgeSource = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    const knowledge = req.knowledge

    if (!knowledge) {
      res.status(404).json({ success: false, message: "Knowledge source not found" })
      return
    }

    const knowledgeId = knowledge._id.toString()

    // 1. Delete chunks from MongoDB
    await KnowledgeChunk.deleteMany({ knowledgeId })

    // 2. Delete vectors from Pinecone
    try {
      const index = await getPineconeIndex()
      await index.deleteMany({ filter: { knowledgeId } })
    } catch (pineconeErr) {
      console.error("Failed to delete chunks from Pinecone:", pineconeErr)
    }

    // 3. Delete Neo4j graph nodes for this document
    try {
      await deleteGraphForKnowledge(knowledgeId, req.user!.id)
    } catch (graphErr) {
      console.error("[GRAPH] Failed to delete graph nodes:", graphErr)
    }

    // 4. Delete physical file from disk
    if (knowledge.path) {
      try {
        await fs.unlink(knowledge.path)
      } catch (err) {
        console.error("Failed to unlink local file:", err)
      }
    }

    // 5. Delete the Knowledge document itself
    await Knowledge.deleteOne({ _id: knowledgeId })

    // Invalidate caches
    await invalidateCache(`cache:user:${req.user.id}:sources`)
    await invalidateCacheByPattern(`cache:user:${req.user.id}:search:*`)

    res.status(200).json({
      success: true,
      message: "Knowledge source deleted successfully",
    })
  } catch (error) {
    console.error("Delete knowledge source error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete knowledge source",
    })
  }
}