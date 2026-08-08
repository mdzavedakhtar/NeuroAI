import { Response } from "express"
import fs from "fs/promises"

import Knowledge from "../models/Knowledge"
import KnowledgeChunk from "../models/KnowledgeChunk"
import { AuthRequest } from "../middleware/auth.middleware"
import { processDocument } from "../services/document.service"
import { getPineconeIndex } from "../services/pinecone.service"

export const uploadKnowledge = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  let knowledgeId: string | null = null

  try {
    // --------------------------------------------------
    // Authentication
    // --------------------------------------------------

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    // --------------------------------------------------
    // File validation
    // --------------------------------------------------

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Please select a file to upload",
      })
      return
    }

    // --------------------------------------------------
    // Create Knowledge record
    // --------------------------------------------------

    const knowledge = await Knowledge.create({
      user: req.user.id,

      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,

      status: "processing",
    })

    knowledgeId = knowledge._id.toString()

    const SUPPORTED_TYPES = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]

    if (SUPPORTED_TYPES.includes(req.file.mimetype)) {
      try {
        const processed = await processDocument(
          req.file.path,
          req.file.mimetype
        )

        const chunkDocuments = processed.chunks.map(
          (chunk, index) => ({
            knowledgeId: knowledge._id,
            userId: req.user!.id,
            chunkIndex: index,
            content: chunk,
            characterCount: chunk.length,
            sourceType: processed.fileType,
            originalName: knowledge.originalName,
            embeddingStatus: "pending",
          })
        )

        if (chunkDocuments.length > 0) {
          await KnowledgeChunk.insertMany(chunkDocuments)
        }

        knowledge.chunks = chunkDocuments.length
        knowledge.characters = processed.characters
        knowledge.status = "ready"
        knowledge.errorMessage = ""

        await knowledge.save()

        res.status(201).json({
          success: true,
          message: `${processed.fileType.toUpperCase()} uploaded, processed and chunked successfully`,
          knowledge: {
            id: knowledge._id,
            originalName: knowledge.originalName,
            mimeType: knowledge.mimeType,
            size: knowledge.size,
            status: knowledge.status,
            pages: processed.pages,
            chunks: knowledge.chunks,
            characters: knowledge.characters,
            fileType: processed.fileType,
            embeddingStatus: "pending",
            createdAt: knowledge.createdAt,
          },
        })

        return
      } catch (processingError) {
        console.error("Document processing error:", processingError)

        await KnowledgeChunk.deleteMany({ knowledgeId: knowledge._id })

        knowledge.status = "failed"
        knowledge.errorMessage =
          processingError instanceof Error
            ? processingError.message
            : "Document processing failed"

        await knowledge.save()

        res.status(422).json({
          success: false,
          message: "Document processing failed",
          knowledge: {
            id: knowledge._id,
            originalName: knowledge.originalName,
            status: knowledge.status,
          },
        })

        return
      }
    }

    // Fallback for any other file type
    knowledge.status = "uploaded"
    await knowledge.save()

    res.status(201).json({
      success: true,
      message: "File uploaded. File type not yet supported for parsing.",
      knowledge: {
        id: knowledge._id,
        originalName: knowledge.originalName,
        mimeType: knowledge.mimeType,
        size: knowledge.size,
        status: knowledge.status,
        createdAt: knowledge.createdAt,
      },
    })
  } catch (error) {
    console.error(
      "Knowledge upload error:",
      error
    )

    // Clean up orphan file only when the
    // Knowledge record was never created.
    if (!knowledgeId && req.file?.path) {
      try {
        await fs.unlink(req.file.path)
      } catch {
        // File may already be gone.
      }
    }

    res.status(500).json({
      success: false,
      message: "Unable to upload knowledge",
    })
  }
}

export const getKnowledgeSources = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    const sources = await Knowledge.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean()

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

export const deleteKnowledgeSource = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    const { knowledgeId } = req.params

    const knowledge = await Knowledge.findOne({
      _id: knowledgeId,
      user: req.user.id,
    })

    if (!knowledge) {
      res.status(404).json({
        success: false,
        message: "Knowledge source not found",
      })
      return
    }

    // 1. Delete chunks from MongoDB
    await KnowledgeChunk.deleteMany({ knowledgeId })

    // 2. Delete vectors from Pinecone
    try {
      const index = await getPineconeIndex()
      await index.deleteMany({
        filter: {
          knowledgeId: knowledgeId,
        },
      })
    } catch (pineconeErr) {
      console.error("Failed to delete chunks from Pinecone:", pineconeErr)
    }

    // 3. Delete physical file from disk (if exists)
    if (knowledge.path) {
      try {
        await fs.unlink(knowledge.path)
      } catch (err) {
        console.error("Failed to unlink local file path:", err)
      }
    }

    // 4. Delete the Knowledge document itself
    await Knowledge.deleteOne({ _id: knowledgeId })

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