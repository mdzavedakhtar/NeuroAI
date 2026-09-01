import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import helmet from "helmet"
import morgan from "morgan"
import cookieParser from "cookie-parser"
import mongoose from "mongoose"
import authRoutes from "./routes/auth.routes"
import knowledgeRoutes from "./routes/knowledge.routes"
import chatRoutes from "./routes/chat.routes"
import graphRoutes from "./routes/graph.routes"
import toolsRoutes from "./routes/tools.routes"
import feedbackRoutes from "./routes/feedback.routes"
import evaluationRoutes from "./routes/evaluation.routes"
import apiKeyRoutes from "./routes/apikey.routes"
import v1Routes from "./routes/v1.routes"
import analyticsRoutes from "./routes/analytics.routes"
import urlRoutes from "./routes/url.routes"
import githubRoutes from "./routes/github.routes"

import { connectDatabase } from "./config/database"
import { verifyNeo4jConnection, createGraphIndexes, closeNeo4jDriver } from "./config/neo4j"
import { requestContextMiddleware } from "./middleware/request-context.middleware"
import { checkRedisHealth } from "./services/redis.service"
import { rateLimiter } from "./middleware/rate-limiter.middleware"
import { errorHandler } from "./middleware/error.middleware"
import { seedDefaultPrompts } from "./services/prompt.service"
import { setupSwagger } from "./config/swagger"

dotenv.config()

// ======================================================
// STARTUP CONFIGURATION VALIDATION
// Fail fast so misconfigurations are obvious immediately.
// ======================================================

const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET", "GEMINI_API_KEY"]
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k])
if (missingEnv.length > 0) {
  console.error(`\n❌ FATAL: Missing required environment variables: ${missingEnv.join(", ")}\n`)
  process.exit(1)
}

const app = express()
const PORT = Number(process.env.PORT) || 5000

// Request context tracking first
app.use(requestContextMiddleware as any)

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
)

app.use(helmet())
app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ======================================================
// RATE LIMITING (Redis-backed)
// ======================================================

app.use("/api", rateLimiter as any)

// Health Check
app.get("/api/health", async (_req, res) => {
  const isRedisHealthy = await checkRedisHealth()
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  const isHealthy = dbStatus === "connected" && isRedisHealthy

  res.status(isHealthy ? 200 : 500).json({
    success: isHealthy,
    service: "NeuroStack AI API",
    status: isHealthy ? "healthy" : "unhealthy",
    database: dbStatus,
    redis: isRedisHealthy ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  })
})
app.use("/api/auth", authRoutes)
app.use("/api/knowledge", knowledgeRoutes)
app.use("/api/chat", chatRoutes)
app.use("/api/graph", graphRoutes)
app.use("/api/tools", toolsRoutes)
app.use("/api/feedback", feedbackRoutes)
app.use("/api/evaluation", evaluationRoutes)
app.use("/api/apikeys", apiKeyRoutes)
app.use("/api/v1", v1Routes)
app.use("/api/analytics", analyticsRoutes)
app.use("/api/knowledge/url", urlRoutes)
app.use("/api/knowledge/github", githubRoutes)

// Setup Swagger API Documentation
setupSwagger(app)

// Global Error Handler
app.use(errorHandler as any)

// Start Server
async function startServer() {
  await connectDatabase()

  // Seed prompts
  await seedDefaultPrompts()

  // Initialize Neo4j Graph DB
  try {
    await verifyNeo4jConnection()
    await createGraphIndexes()
  } catch (error) {
    console.warn("⚠️ Neo4j connection initialization failed:", (error as Error).message)
    console.warn("Graph DB features will be offline.")
  }

  const server = app.listen(PORT, () => {
    console.log("")
    console.log("🚀 NeuroStack AI Backend")
    console.log(`🌐 Server: http://localhost:${PORT}`)
    console.log(`❤️ Health: http://localhost:${PORT}/api/health`)
    console.log("")
  })

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nStopping server gracefully...")
    server.close(async () => {
      await closeNeo4jDriver()
      console.log("Server stopped.")
      process.exit(0)
    })
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

startServer()