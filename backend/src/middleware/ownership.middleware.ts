import { NextFunction, Response } from "express"
import mongoose from "mongoose"
import { AuthRequest } from "./auth.middleware"
import Knowledge from "../models/Knowledge"

export const verifyKnowledgeOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    const knowledgeId =
      (req.params.knowledgeId as string) ||
      (req.body.knowledgeId as string) ||
      (req.query.knowledgeId as string)

    if (!knowledgeId) {
      next()
      return
    }

    if (!mongoose.Types.ObjectId.isValid(knowledgeId)) {
      res.status(400).json({
        success: false,
        message: "Invalid knowledge ID format",
      })
      return
    }

    const knowledge = await Knowledge.findById(knowledgeId)

    if (!knowledge) {
      res.status(404).json({
        success: false,
        message: "Knowledge source not found",
      })
      return
    }

    if (knowledge.user.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this knowledge resource",
      })
      return
    }

    // Attach to request for controller reuse
    req.knowledge = knowledge
    next()
  } catch (error) {
    console.error("Knowledge ownership verification error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error during ownership verification",
    })
  }
}
