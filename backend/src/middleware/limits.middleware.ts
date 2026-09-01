import { NextFunction, Response } from "express"
import { AuthRequest } from "./auth.middleware"
import { checkLimits, trackRequest } from "../services/usage.service"

export const checkRequestLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    const { allowed, message } = await checkLimits(req.user.id, "requests")
    if (!allowed) {
      res.status(429).json({
        success: false,
        message: message || "API Request limit exceeded.",
      })
      return
    }

    // Automatically track/increment the request
    await trackRequest(req.user.id)
    next()
  } catch (error) {
    console.error("Error in checkRequestLimit middleware:", error)
    next()
  }
}

export const checkDocumentLimits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    // 1. Check document count limit
    const docCheck = await checkLimits(req.user.id, "documents")
    if (!docCheck.allowed) {
      res.status(403).json({
        success: false,
        message: docCheck.message || "Document count limit reached.",
      })
      return
    }

    // 2. Check storage limit
    const fileSize = req.file?.size || 0
    const storageCheck = await checkLimits(req.user.id, "storage", fileSize)
    if (!storageCheck.allowed) {
      res.status(403).json({
        success: false,
        message: storageCheck.message || "Storage limit reached.",
      })
      return
    }

    next()
  } catch (error) {
    console.error("Error in checkDocumentLimits middleware:", error)
    next()
  }
}
