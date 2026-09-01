import { Router } from "express"

import {
  getMe,
  loginUser,
  registerUser,
  updateProfile,
  changePassword,
  verifyEmail,
  resendVerification,
  googleAuth,
  googleCallback,
} from "../controllers/auth.controller"

import { protect } from "../middleware/auth.middleware"
import rateLimit from "express-rate-limit"

const router = Router()

// Credential-stuffing guard for login/register
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts, please try again later.",
  },
})

// Public routes
router.post("/register", credentialLimiter, registerUser)
router.post("/login", credentialLimiter, loginUser)
router.post("/verify-email", verifyEmail)
router.post("/resend-verification", resendVerification)

// Google OAuth
router.get("/google", googleAuth)
router.get("/google/callback", googleCallback)

// Protected user routes
router.get("/me", protect, getMe)
router.put("/me", protect, updateProfile)
router.put("/password", protect, changePassword)

export default router