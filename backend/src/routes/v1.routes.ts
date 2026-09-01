import { Router } from "express"
import fs from "fs/promises"
import path from "path"
import mongoose from "mongoose"

import { protect } from "../middleware/auth.middleware"
import { checkRequestLimit, checkDocumentLimits } from "../middleware/limits.middleware"
import { knowledgeUpload } from "../middleware/upload.middleware"
import { verifyFileSignature } from "../controllers/knowledge.controller"
import { searchKnowledge, buildKnowledgeContext } from "../services/pinecone.service"
import { generateRagAnswer } from "../services/gemini.service"
import { buildMemoryContext } from "../services/memory.service"
import { getTool } from "../services/tools/tool.registry"
import { trackGeneration, trackRequest, checkLimits } from "../services/usage.service"

import Knowledge from "../models/Knowledge"
import Conversation from "../models/Conversation"
import Message from "../models/Message"

const router = Router()

router.use(protect)
router.use(checkRequestLimit as any)

/**
 * @openapi
 * /v1/knowledge/search:
 *   post:
 *     summary: Search knowledge base semantically
 *     description: Performs a vector search over the user's uploaded documents.
 *     tags: [Knowledge]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 example: "What is React hooks?"
 *               knowledgeId:
 *                 type: string
 *                 description: Optional filter by specific knowledge document ID
 *                 example: "64a1b2c3d4e5f6789abcdef0"
 *               limit:
 *                 type: integer
 *                 default: 5
 *                 example: 5
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sourceNumber:
 *                         type: integer
 *                       text:
 *                         type: string
 *                       score:
 *                         type: number
 *                       fileName:
 *                         type: string
 *                       pageNumber:
 *                         type: integer
 *                       chunkIndex:
 *                         type: integer
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: Storage or plan limits exceeded
 *       404:
 *         description: Knowledge base not found
 */
router.post("/knowledge/search", async (req: any, res) => {
  try {
    const { query, knowledgeId, limit = 5 } = req.body

    if (!query || !query.trim()) {
      res.status(400).json({ success: false, message: "Search query is required" })
      return
    }

    // Verify ownership of the knowledgeId if specified
    if (knowledgeId) {
      if (!mongoose.Types.ObjectId.isValid(knowledgeId)) {
        res.status(400).json({ success: false, message: "Invalid knowledgeId format" })
        return
      }

      const doc = await Knowledge.findOne({ _id: knowledgeId, user: req.user.id })
      if (!doc) {
        res.status(404).json({ success: false, message: "Knowledge document not found" })
        return
      }
    }

    const results = await searchKnowledge({
      query: query.trim(),
      userId: req.user.id,
      knowledgeId,
      topK: Number(limit),
    })

    res.status(200).json({
      success: true,
      results: results.map((r, idx) => ({
        sourceNumber: idx + 1,
        text: r.text,
        score: r.score,
        fileName: r.originalName,
        pageNumber: r.pageNumber,
        chunkIndex: r.chunkIndex,
      })),
    })
  } catch (error) {
    console.error("V1 Knowledge search error:", error)
    res.status(500).json({ success: false, message: "Failed to query knowledge index" })
  }
})

/**
 * @openapi
 * /v1/knowledge/upload:
 *   post:
 *     summary: Upload document to knowledge base
 *     description: Uploads a PDF, DOCX, XLSX, or PPTX file. The ingestion pipeline runs in the background.
 *     tags: [Knowledge]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 knowledge:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     mimeType:
 *                       type: string
 *                     size:
 *                       type: integer
 *                     status:
 *                       type: string
 *       400:
 *         description: File missing or invalid extension/content
 *       403:
 *         description: Document count or storage limits exceeded
 */
router.post(
  "/knowledge/upload",
  (req, res, next) => {
    knowledgeUpload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message })
      }
      next()
    })
  },
  checkDocumentLimits as any,
  async (req: any, res) => {
    let uploadedFilePath: string | null = null

    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "Please select a file to upload" })
        return
      }

      uploadedFilePath = req.file.path
      const extension = path.extname(req.file.originalname).toLowerCase()

      // Verify file signature magic bytes
      const isValid = await verifyFileSignature(uploadedFilePath as string, extension)
      if (!isValid) {
        await fs.unlink(uploadedFilePath as string).catch(() => {})
        res.status(400).json({
          success: false,
          message: "Invalid file content. File contents do not match the declared file extension.",
        })
        return
      }

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

      res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
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
      console.error("V1 Knowledge upload error:", error)
      if (uploadedFilePath) {
        await fs.unlink(uploadedFilePath).catch(() => {})
      }
      res.status(500).json({ success: false, message: "Failed to upload knowledge source" })
    }
  }
)

/**
 * @openapi
 * /v1/knowledge/{id}:
 *   get:
 *     summary: Get document status
 *     description: Retrieves the current status of document ingestion (uploaded, parsing, vector_indexing, ready, etc.).
 *     tags: [Knowledge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 knowledge:
 *                   type: object
 *       400:
 *         description: Invalid document ID
 *       404:
 *         description: Document not found
 */
router.get("/knowledge/:id", async (req: any, res) => {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid document ID format" })
      return
    }

    const doc = await Knowledge.findOne({ _id: id, user: req.user.id })
    if (!doc) {
      res.status(404).json({ success: false, message: "Knowledge document not found" })
      return
    }

    res.status(200).json({
      success: true,
      knowledge: {
        id: doc._id,
        originalName: doc.originalName,
        status: doc.status,
        currentStep: doc.currentStep,
        errorMessage: doc.errorMessage,
        chunks: doc.chunks,
        createdAt: doc.createdAt,
      },
    })
  } catch (error) {
    console.error("V1 Get knowledge status error:", error)
    res.status(500).json({ success: false, message: "Failed to get document status" })
  }
})

/**
 * @openapi
 * /v1/chat:
 *   post:
 *     summary: Send message to assistant
 *     description: Generates a grounded response using optional attached document and conversation history.
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Summarize this account."
 *               conversationId:
 *                 type: string
 *                 description: Optional ID of existing conversation session to append message
 *                 example: "64a1b2c3d4e5f6789abcdef1"
 *               knowledgeId:
 *                 type: string
 *                 description: Optional document ID to ground the answer (if creating a new session)
 *                 example: "64a1b2c3d4e5f6789abcdef0"
 *     responses:
 *       200:
 *         description: Chat response generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 conversationId:
 *                   type: string
 *                 answer:
 *                   type: string
 *                 sources:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: AI generations or plan limits exceeded
 */
router.post("/chat", async (req: any, res) => {
  try {
    const { message, conversationId, knowledgeId } = req.body

    if (!message || !message.trim()) {
      res.status(400).json({ success: false, message: "Message is required" })
      return
    }

    // 1. Check AI Generations Limit
    const genCheck = await checkLimits(req.user.id, "aiGenerations")
    if (!genCheck.allowed) {
      res.status(403).json({ success: false, message: genCheck.message })
      return
    }

    let activeConversation: any = null

    if (conversationId) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        res.status(400).json({ success: false, message: "Invalid conversation ID format" })
        return
      }
      activeConversation = await Conversation.findOne({ _id: conversationId, userId: req.user.id })
      if (!activeConversation) {
        res.status(404).json({ success: false, message: "Conversation not found" })
        return
      }
    } else {
      // Auto-create developer conversation
      let targetKnowledgeId: string | undefined = undefined
      if (knowledgeId) {
        if (!mongoose.Types.ObjectId.isValid(knowledgeId)) {
          res.status(400).json({ success: false, message: "Invalid knowledgeId format" })
          return
        }
        const doc = await Knowledge.findOne({ _id: knowledgeId, user: req.user.id })
        if (!doc) {
          res.status(404).json({ success: false, message: "Knowledge document not found" })
          return
        }
        targetKnowledgeId = doc._id.toString()
      }

      activeConversation = await Conversation.create({
        userId: req.user.id,
        knowledgeId: targetKnowledgeId,
        title: message.trim().slice(0, 40) || "API Chat Session",
      })
    }

    const cleanMessage = message.trim()

    // Save user message
    await Message.create({
      conversationId: activeConversation._id,
      userId: req.user.id,
      role: "user",
      content: cleanMessage,
      sources: [],
    })

    // Search knowledge chunks if document attached
    let results: any[] = []
    let context = ""

    if (activeConversation.knowledgeId) {
      results = await searchKnowledge({
        query: cleanMessage,
        userId: req.user.id,
        knowledgeId: activeConversation.knowledgeId.toString(),
        topK: 5,
      })
      context = buildKnowledgeContext(results)
    }

    const { conversationHistory } = await buildMemoryContext(activeConversation._id.toString(), req.user.id)

    let answer: string
    if (!activeConversation.knowledgeId) {
      answer = await generateRagAnswer({
        question: cleanMessage,
        context: "",
        conversationHistory,
      })
    } else if (!context.trim()) {
      answer = "I could not find relevant information in the uploaded knowledge base."
    } else {
      answer = await generateRagAnswer({
        question: cleanMessage,
        context,
        conversationHistory,
      })
    }

    const sources = results.map((result, index) => ({
      sourceNumber: index + 1,
      fileName: result.originalName,
      chunkIndex: result.chunkIndex,
      pageNumber: result.pageNumber ?? 1,
      score: result.score,
      knowledgeId: result.knowledgeId,
      chunkId: result.id,
      relevanceScore: result.score,
    }))

    // Save assistant message
    await Message.create({
      conversationId: activeConversation._id,
      userId: req.user.id,
      role: "assistant",
      content: answer,
      sources,
    })

    // Track generation and estimated tokens
    await trackGeneration(req.user.id)
    const estimatedTokens = Math.ceil((cleanMessage.length + answer.length) / 4)
    await trackRequest(req.user.id, estimatedTokens)

    res.status(200).json({
      success: true,
      conversationId: activeConversation._id,
      answer,
      sources,
    })
  } catch (error) {
    console.error("V1 Chat error:", error)
    res.status(500).json({ success: false, message: "Generative answer generation failed" })
  }
})

/**
 * @openapi
 * /v1/tools/{toolName}:
 *   post:
 *     summary: Run modular workspace tool
 *     description: Runs one of the 10 workspace tools (e.g. summarizer, translator, test-generator).
 *     tags: [Tools]
 *     parameters:
 *       - name: toolName
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "summarizer"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 example: "Text to summarize or translate"
 *               code:
 *                 type: string
 *                 example: "function test() {}"
 *               query:
 *                 type: string
 *                 example: "What is custom RAG?"
 *               language:
 *                 type: string
 *                 example: "Spanish"
 *     responses:
 *       200:
 *         description: Tool run successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing parameter or validation failed
 *       404:
 *         description: Tool not found
 */
router.post("/tools/:toolName", async (req: any, res) => {
  try {
    const { toolName } = req.params
    const tool = getTool(toolName)

    if (!tool) {
      res.status(404).json({ success: false, message: `Workspace tool '${toolName}' not found` })
      return
    }

    // Validate inputs
    const validation = tool.validate(req.body)
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: validation.errors?.join(", ") || "Invalid parameters for tool",
      })
      return
    }

    const result = await tool.execute(req.body, {
      userId: req.user.id,
      knowledgeId: req.body.knowledgeId,
    })

    // Track generation limit and estimated token counts
    await trackGeneration(req.user.id)
    const inputStr = JSON.stringify(req.body)
    const outputStr = typeof result.output === "string" ? result.output : JSON.stringify(result.output || "")
    const estimatedTokens = Math.ceil((inputStr.length + outputStr.length) / 4)
    await trackRequest(req.user.id, estimatedTokens)

    res.status(200).json(result)
  } catch (error) {
    console.error(`V1 Tool execution error for ${req.params.toolName}:`, error)
    res.status(500).json({ success: false, message: "Tool execution failed" })
  }
})

export default router
