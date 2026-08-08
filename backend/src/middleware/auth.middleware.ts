import { NextFunction, Request, Response } from "express"
import jwt, { JwtPayload } from "jsonwebtoken"

import User from "../models/User"

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
  }
}

/*
|--------------------------------------------------------------------------
| Authentication Middleware
|--------------------------------------------------------------------------
| Expected header:
| Authorization: Bearer <JWT_TOKEN>
*/

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authorization = req.headers.authorization

    // Check Authorization header
    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    // Extract token
    const token = authorization.split(" ")[1]

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication token missing",
      })
      return
    }

    const secret = process.env.JWT_SECRET

    if (!secret) {
      throw new Error(
        "JWT_SECRET is missing in environment variables"
      )
    }

    // Verify JWT
    const decoded = jwt.verify(
      token,
      secret
    ) as TokenPayload

    if (!decoded.userId) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      })
      return
    }

    // Find current user
    const user = await User.findById(decoded.userId)

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User no longer exists",
      })
      return
    }

    // Block disabled accounts
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "This account has been disabled",
      })
      return
    }

    // Attach safe user information to request
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
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