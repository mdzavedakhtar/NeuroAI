import { Request, Response, NextFunction } from "express"
import { logger } from "../utils/logger"

export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500
  const message = err.isOperational ? err.message : "An unexpected error occurred. Please try again."
  const requestId = res.getHeader("x-request-id") || ""

  // Log detailed internal info via structured logger
  logger.error(`[ERROR_HANDLER] Request failed on ${req.method} ${req.originalUrl}: ${err.message}`, {
    statusCode,
    isOperational: err.isOperational || false,
    stack: err.stack,
    route: req.originalUrl,
    method: req.method,
  })

  // Respond to client securely without exposing system details or stack traces
  res.status(statusCode).json({
    success: false,
    message,
    requestId,
  })
}
