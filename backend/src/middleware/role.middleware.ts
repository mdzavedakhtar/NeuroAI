import { NextFunction, Response } from "express"

import { AuthRequest } from "./auth.middleware"
import { UserRole } from "../models/User"

/*
|--------------------------------------------------------------------------
| Role Based Access Control
|--------------------------------------------------------------------------
| Example:
|
| router.get(
|   "/admin",
|   protect,
|   authorizeRoles("admin"),
|   controller
| )
*/

export const authorizeRoles = (
  ...allowedRoles: UserRole[]
) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    // User must already be authenticated
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    const userRole = req.user.role as UserRole

    // Check whether user's role is allowed
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message:
          "You do not have permission to access this resource",
      })
      return
    }

    next()
  }
}