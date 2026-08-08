import { Router } from "express"

import {
  getMe,
  loginUser,
  registerUser,
} from "../controllers/auth.controller"

import { protect } from "../middleware/auth.middleware"
import { authorizeRoles } from "../middleware/role.middleware"

const router = Router()

// Public routes
router.post("/register", registerUser)
router.post("/login", loginUser)

// Protected user route
router.get("/me", protect, getMe)

// Temporary RBAC test route
router.get(
  "/admin-test",
  protect,
  authorizeRoles("admin"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Admin access granted",
    })
  }
)

export default router