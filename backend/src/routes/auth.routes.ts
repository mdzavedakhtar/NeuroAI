import { Router } from "express"

import {
  getMe,
  loginUser,
  registerUser,
  updateProfile,
  changePassword,
} from "../controllers/auth.controller"

import { protect } from "../middleware/auth.middleware"

const router = Router()

// Public routes
router.post("/register", registerUser)
router.post("/login", loginUser)

// Protected user routes
router.get("/me", protect, getMe)
router.put("/me", protect, updateProfile)
router.put("/password", protect, changePassword)

export default router