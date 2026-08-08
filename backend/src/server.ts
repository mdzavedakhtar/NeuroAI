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

import { connectDatabase } from "./config/database"

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

// Start Server
async function startServer() {
  await connectDatabase()

  app.listen(PORT, () => {
    console.log("")
    console.log("🚀 NeuroStack AI Backend")
    console.log(`🌐 Server: http://localhost:${PORT}`)
    console.log(`❤️ Health: http://localhost:${PORT}/api/health`)
    console.log("")
  })
}

startServer()