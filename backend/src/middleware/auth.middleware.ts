import { NextFunction, Request, Response } from "express"
import jwt, { JwtPayload } from "jsonwebtoken"

import User from "../models/User"
import { requestStore } from "../utils/logger"
import { validateApiKey } from "../services/apikey.service"

interface TokenPayload extends JwtPayload {
  userId: string
  role: string
}

export interface AuthRequest extends Request {
  user?: {
    id: string
    name: string
    email: string
    role: string
    avatar?: string
    isEmailVerified: boolean
    plan?: string
  }
  knowledge?: any
}

/*
|--------------------------------------------------------------------------
| Authentication Middleware
|--------------------------------------------------------------------------
| Expected header:
| Authorization: Bearer <JWT_TOKEN_OR_API_KEY>
| or
| X-API-Key: <API_KEY>
*/

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKeyHeader = req.headers["x-api-key"] as string | undefined
    const authorization = req.headers.authorization

    let token: string | undefined = apiKeyHeader

    // If no X-API-Key, check Authorization header
    if (!token && authorization && authorization.startsWith("Bearer ")) {
      token = authorization.split(" ")[1]
    }

    // Check if it's an API Key (starts with "ns_")
    if (token && token.startsWith("ns_")) {
      const apiKeyRecord = await validateApiKey(token)
      if (!apiKeyRecord) {
        res.status(401).json({
          success: false,
          message: "Invalid API key",
        })
        return
      }

      const user = apiKeyRecord.user as any
      if (!user) {
        res.status(401).json({
          success: false,
          message: "User associated with this API key no longer exists",
        })
        return
      }

      if (!user.isActive) {
        res.status(403).json({
          success: false,
          message: "This account has been disabled",
        })
        return
      }

      req.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        plan: user.plan || "free",
      }

      const store = requestStore.getStore()
      if (store) {
        store.set("userId", user._id.toString())
      }

      next()
      return
    }

    // Fall back to JWT authentication
    if (!authorization || !authorization.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    const jwtToken = authorization.split(" ")[1]
    if (!jwtToken) {
      res.status(401).json({
        success: false,
        message: "Authentication token missing",
      })
      return
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error("JWT_SECRET is missing in environment variables")
    }

    const decoded = jwt.verify(jwtToken, secret) as TokenPayload
    if (!decoded.userId) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      })
      return
    }

    const user = await User.findById(decoded.userId)
    if (!user) {
      res.status(401).json({
        success: false,
        message: "User no longer exists",
      })
      return
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "This account has been disabled",
      })
      return
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      plan: user.plan || "free",
    }

    const store = requestStore.getStore()
    if (store) {
      store.set("userId", user._id.toString())
    }

    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Authentication token has expired",
      })
      return
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      })
      return
    }

    console.error("Authentication middleware error:", error)
    res.status(500).json({
      success: false,
      message: "Authentication failed",
    })
  }
}