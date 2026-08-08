import {
  Request,
  Response,
} from "express"

import mongoose from "mongoose"

import Conversation from "../models/Conversation"
import Message from "../models/Message"
import {
  searchKnowledge,
  buildKnowledgeContext,
} from "../services/pinecone.service"

import {
  generateRagAnswer,
  generateRagAnswerStream,
} from "../services/gemini.service"

const getUserId = (req: Request) => {
  const user = (req as any).user

  return (
    user?._id?.toString?.() ||
    user?.id?.toString?.() ||
    ""
  )
}

export const createConversation = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      })
    }

    const {
      title,
      knowledgeId,
    } = req.body

    if (
      knowledgeId &&
      !mongoose.Types.ObjectId.isValid(
        knowledgeId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid knowledgeId",
      })
    }

    const conversation =
      await Conversation.create({
        userId,

        knowledgeId:
          knowledgeId || undefined,

        title:
          title?.trim() ||
          "New Conversation",
      })

    return res.status(201).json({
      success: true,
      conversation,
    })
  } catch (error) {
    console.error(
      "Create conversation error:",
      error
    )

    return res.status(500).json({
      success: false,
      message:
        "Failed to create conversation",
    })
  }
}

export const getConversations = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = getUserId(req)

    const conversations =
      await Conversation.find({
        userId,
      })
        .sort({
          updatedAt: -1,
        })
        .lean()

    return res.status(200).json({
      success: true,
      count: conversations.length,
      conversations,
    })
  } catch (error) {
    console.error(
      "Get conversations error:",
      error
    )

    return res.status(500).json({
      success: false,
      message:
        "Failed to load conversations",
    })
  }
}

export const getConversationMessages =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const userId = getUserId(req)

      const conversationId =
        req.params.conversationId as string

      if (
        !mongoose.Types.ObjectId.isValid(
          conversationId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid conversation ID",
        })
      }

      const conversation =
        await Conversation.findOne({
          _id: conversationId,
          userId,
        })

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message:
            "Conversation not found",
        })
      }

      const messages =
        await Message.find({
          conversationId,
          userId,
        })
          .sort({
            createdAt: 1,
          })
          .lean()

      return res.status(200).json({
        success: true,
        conversation,
        count: messages.length,
        messages,
      })
    } catch (error) {
      console.error(
        "Get messages error:",
        error
      )

      return res.status(500).json({
        success: false,
        message:
          "Failed to load messages",
      })
    }
  }

export const deleteConversation = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = getUserId(req)

    const conversationId =
      req.params.conversationId as string

    if (
      !mongoose.Types.ObjectId.isValid(
        conversationId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid conversation ID",
      })
    }

    const conversation =
      await Conversation.findOneAndDelete({
        _id: conversationId,
        userId,
      })

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message:
          "Conversation not found",
      })
    }

    await Message.deleteMany({
      conversationId,
      userId,
    })

    return res.status(200).json({
      success: true,
      message:
        "Conversation deleted successfully",
    })
  } catch (error) {
    console.error(
      "Delete conversation error:",
      error
    )

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete conversation",
    })
  }
}

// ======================================================
// SEND MESSAGE + RAG ANSWER
// ======================================================

export const sendChatMessage = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      })
    }

    const conversationId =
      req.params.conversationId as string

    const { message } = req.body

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(
        conversationId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      })
    }

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      })
    }

    const cleanMessage = message.trim()

    // --------------------------------------------------
    // FIND USER CONVERSATION
    // --------------------------------------------------

    const conversation =
      await Conversation.findOne({
        _id: conversationId,
        userId,
      })

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      })
    }

    // --------------------------------------------------
    // SAVE USER MESSAGE
    // --------------------------------------------------

// --------------------------------------------------
// DUPLICATE REQUEST PROTECTION
// --------------------------------------------------

const duplicateWindow =
  new Date(Date.now() - 5000)

const recentDuplicate =
  await Message.findOne({
    conversationId,
    userId,
    role: "user",
    content: cleanMessage,
    createdAt: {
      $gte: duplicateWindow,
    },
  })
    .sort({
      createdAt: -1,
    })
    .lean()

if (recentDuplicate) {
  return res.status(409).json({
    success: false,
    message:
      "This message was already submitted.",
  })
}

    const userMessage =
      await Message.create({
        conversationId,
        userId,

        role: "user",

        content: cleanMessage,

        sources: [],
      })

    // --------------------------------------------------
    // SEARCH USER KNOWLEDGE (IF ATTACHED)
    // --------------------------------------------------

    let results: any[] = []
    let context = ""

    if (conversation.knowledgeId) {
      results = await searchKnowledge({
        query: cleanMessage,
        userId,
        knowledgeId: conversation.knowledgeId.toString(),
        topK: 8,
      })
      context = buildKnowledgeContext(results)
      console.log(`[RAG] Retrieved ${results.length} chunk(s) for context assembly.`)
    }

    // --------------------------------------------------
    // GENERATE ANSWER
    // --------------------------------------------------

    let answer: string

    if (!conversation.knowledgeId) {
      // General conversation
      console.log(`[LLM] Generating general answer (no document context).`)
      answer = await generateRagAnswer({
        question: cleanMessage,
        context: "",
      })
    } else if (!context.trim()) {
      // Knowledge base attached but no relevant chunks found
      console.log(`[LLM] No relevant chunks found for query. Returning fallback.`)
      answer = "I could not find relevant information in the uploaded knowledge base."
    } else {
      // Grounded RAG answer
      console.log(`[LLM] Generating grounded answer from ${results.length} retrieved chunk(s).`)
      answer = await generateRagAnswer({
        question: cleanMessage,
        context,
      })
    }

    // --------------------------------------------------
    // BUILD SOURCES
    // --------------------------------------------------

    const sources = results.map(
      (result, index) => ({
        sourceNumber: index + 1,
        fileName:    result.originalName,
        chunkIndex:  result.chunkIndex,
        pageNumber:  result.pageNumber ?? 1,
        score:       result.score,
        knowledgeId: result.knowledgeId,
      })
    )

    // --------------------------------------------------
    // SAVE AI MESSAGE
    // --------------------------------------------------

    const assistantMessage =
      await Message.create({
        conversationId,
        userId,

        role: "assistant",

        content: answer,

        sources,
      })

    // --------------------------------------------------
    // AUTO TITLE
    // --------------------------------------------------

    if (
      conversation.title ===
      "New Conversation"
    ) {
      conversation.title =
        cleanMessage.length > 60
          ? `${cleanMessage.slice(
              0,
              57
            )}...`
          : cleanMessage
    }

    // Force updatedAt refresh
    conversation.updatedAt =
      new Date()

    await conversation.save()

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      conversationId:
        conversation._id,

      userMessage,

      assistantMessage,

      answer,

      sources,
    })
  } catch (error) {
    console.error(
      "Send chat message error:",
      error
    )

    return res.status(500).json({
      success: false,

      message:
        error instanceof Error
          ? error.message
          : "Unable to send message",
    })
  }
}

export const sendChatMessageStream = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      })
    }

    const conversationId = req.params.conversationId as string
    const { message, model } = req.body

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      })
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      })
    }

    const cleanMessage = message.trim()

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    })

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      })
    }

    // Duplicate protection
    const duplicateWindow = new Date(Date.now() - 5000)
    const recentDuplicate = await Message.findOne({
      conversationId,
      userId,
      role: "user",
      content: cleanMessage,
      createdAt: { $gte: duplicateWindow },
    }).sort({ createdAt: -1 }).lean()

    if (recentDuplicate) {
      return res.status(409).json({
        success: false,
        message: "This message was already submitted.",
      })
    }

    // Create user message
    const userMessage = await Message.create({
      conversationId,
      userId,
      role: "user",
      content: cleanMessage,
      sources: [],
    })

    let results: any[] = []
    let context = ""

    if (conversation.knowledgeId) {
      results = await searchKnowledge({
        query: cleanMessage,
        userId,
        knowledgeId: conversation.knowledgeId.toString(),
        topK: 8,
      })
      context = buildKnowledgeContext(results)
      console.log(`[RAG] Retrieved ${results.length} chunk(s) for context assembly.`)
    }

    const sources = results.map((result, index) => ({
      sourceNumber: index + 1,
      fileName:    result.originalName,
      chunkIndex:  result.chunkIndex,
      pageNumber:  result.pageNumber ?? 1,
      score:       result.score,
      knowledgeId: result.knowledgeId,
    }))

    // Setup SSE Headers
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache, no-transform")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    // Send meta event immediately with sources
    res.write(`data: ${JSON.stringify({ type: "meta", userMessage, sources })}\n\n`)

    let answer = ""
    let responseStream

    if (!conversation.knowledgeId) {
      console.log(`[LLM] Generating general answer (no document context).`)
      responseStream = await generateRagAnswerStream({
        question: cleanMessage,
        context: "",
        model,
      })
    } else if (!context.trim()) {
      console.log(`[LLM] No relevant chunks found for query. Returning fallback.`)
      answer = "I could not find enough information in the uploaded documents to answer this question."
    } else {
      console.log(`[LLM] Generating grounded answer from ${results.length} retrieved chunk(s).`)
      responseStream = await generateRagAnswerStream({
        question: cleanMessage,
        context,
        model,
      })
    }

    if (responseStream) {
      try {
        for await (const chunk of responseStream) {
          const chunkText = chunk.text || ""
          answer += chunkText
          res.write(`data: ${JSON.stringify({ type: "content", text: chunkText })}\n\n`)
        }
        console.log(`[LLM] Stream generation complete. Answer length: ${answer.length} chars.`)
      } catch (streamError) {
        console.error("[LLM] Gemini stream error:", streamError)
        res.write(`data: ${JSON.stringify({ type: "error", message: "Stream generation error" })}\n\n`)
      }
    } else if (answer) {
      res.write(`data: ${JSON.stringify({ type: "content", text: answer })}\n\n`)
    }

    // Save AI message to DB
    const assistantMessage = await Message.create({
      conversationId,
      userId,
      role: "assistant",
      content: answer || "No response generated.",
      sources,
    })

    // Auto title update
    if (conversation.title === "New Conversation") {
      conversation.title = cleanMessage.length > 60
        ? `${cleanMessage.slice(0, 57)}...`
        : cleanMessage
    }

    conversation.updatedAt = new Date()
    await conversation.save()

    // Send final done event
    res.write(`data: ${JSON.stringify({ type: "done", assistantMessage, conversation })}\n\n`)
    res.end()

  } catch (error) {
    console.error("Streaming chat message error:", error)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unable to stream message",
      })
    } else {
      res.end()
    }
  }
}