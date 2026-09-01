import { NextFunction, Response } from "express"
import crypto from "crypto"
import { AuthRequest } from "./auth.middleware"
import { requestStore } from "../utils/logger"

export const requestContextMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID()
  res.setHeader("x-request-id", requestId)

  const store = new Map<string, any>()
  store.set("requestId", requestId)

  requestStore.run(store, () => {
    next()
  })
}
