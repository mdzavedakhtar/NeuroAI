import { Router } from "express"
import { protect } from "../middleware/auth.middleware"
import { getSystemAnalytics } from "../controllers/analytics.controller"

const router = Router()

// Analytics is general or restricted to authenticated dashboard accounts
router.get("/stats", protect, getSystemAnalytics)

export default router
