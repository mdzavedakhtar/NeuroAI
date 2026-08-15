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

import { connectDatabase } from "./config/database"
import { verifyNeo4jConnection, createGraphIndexes, closeNeo4jDriver } from "./config/neo4j"

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 5000

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

// Health Check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "NeuroStack AI API",
    status: "healthy",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    timestamp: new Date().toISOString(),
  })
})
app.use("/api/auth", authRoutes)
app.use("/api/knowledge", knowledgeRoutes)
app.use("/api/chat", chatRoutes)
app.use("/api/graph", graphRoutes)

// Start Server
async function startServer() {
  await connectDatabase()

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