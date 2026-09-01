import { Response } from "express"
import { AuthRequest } from "../middleware/auth.middleware"
import Feedback from "../models/Feedback"
import Message from "../models/Message"
import mongoose from "mongoose"
import { logger } from "../utils/logger"

export const submitFeedback = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const conversationId = req.body.conversationId as string
    const messageId = req.body.messageId as string
    const rating = req.body.rating as string
    const reason = req.body.reason as string
    const userId = req.user!.id

    if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
      res.status(400).json({ success: false, message: "Invalid IDs provided" })
      return
    }

    if (!["helpful", "not_helpful"].includes(rating)) {
      res.status(400).json({ success: false, message: "Rating must be 'helpful' or 'not_helpful'" })
      return
    }

    // Verify the message actually exists and belongs to this conversation/user
    const messageExists = await Message.findOne({
      _id: new mongoose.Types.ObjectId(messageId),
      conversationId: new mongoose.Types.ObjectId(conversationId),
      userId: new mongoose.Types.ObjectId(userId)
    })
    if (!messageExists) {
      res.status(404).json({ success: false, message: "Message not found" })
      return
    }

    // Upsert feedback
    const feedback = await Feedback.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        messageId: new mongoose.Types.ObjectId(messageId)
      },
      {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        rating: rating as "helpful" | "not_helpful",
        reason: reason || ""
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.status(200).json({
      success: true,
      message: "Feedback submitted successfully",
      feedback,
    })
  } catch (error) {
    logger.error("[FEEDBACK] Failed to submit feedback:", error)
    res.status(500).json({
      success: false,
      message: "Failed to submit feedback",
    })
  }
}

export const getMessageFeedback = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const messageId = req.params.messageId as string
    const userId = req.user!.id

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      res.status(400).json({ success: false, message: "Invalid message ID" })
      return
    }

    const feedback = await Feedback.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      messageId: new mongoose.Types.ObjectId(messageId)
    }).lean()

    res.status(200).json({
      success: true,
      feedback,
    })
  } catch (error) {
    logger.error("[FEEDBACK] Failed to get feedback:", error)
    res.status(500).json({
      success: false,
      message: "Failed to load feedback",
    })
  }
}
