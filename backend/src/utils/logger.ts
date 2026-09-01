import { AsyncLocalStorage } from "async_hooks"

export const requestStore = new AsyncLocalStorage<Map<string, any>>()

const SENSITIVE_KEYS = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "token",
  "jwt",
  "authorization",
  "apikey",
  "gemini_api_key",
  "pinecone_api_key",
  "neo4j_password",
  "secret",
])

function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== "object") return obj
  if (Array.isArray(obj)) {
    return obj.map(sanitize)
  }

  const result: any = {}
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = "[REDACTED]"
    } else if (lowerKey === "text" || lowerKey === "content" || lowerKey === "chunks") {
      if (typeof obj[key] === "string" && obj[key].length > 100) {
        result[key] = obj[key].slice(0, 100) + "... [TRUNCATED]"
      } else {
        result[key] = obj[key]
      }
    } else {
      result[key] = sanitize(obj[key])
    }
  }
  return result
}

function log(level: "info" | "warn" | "error" | "debug", message: string, meta?: any) {
  const store = requestStore.getStore()
  const requestId = store?.get("requestId") || ""
  const userId = store?.get("userId") || ""

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    requestId,
    userId,
    message,
    metadata: meta ? sanitize(meta) : undefined,
  }

  const logStr = JSON.stringify(logEntry)
  if (level === "error") {
    console.error(logStr)
  } else if (level === "warn") {
    console.warn(logStr)
  } else {
    console.log(logStr)
  }
}

export const logger = {
  info: (message: string, meta?: any) => log("info", message, meta),
  warn: (message: string, meta?: any) => log("warn", message, meta),
  error: (message: string, meta?: any) => log("error", message, meta),
  debug: (message: string, meta?: any) => log("debug", message, meta),
}
