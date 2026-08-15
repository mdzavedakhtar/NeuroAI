import { Request, Response } from "express"

import User from "../models/User"
import { generateToken } from "../utils/generateToken"

/*
|--------------------------------------------------------------------------
| Register User
|--------------------------------------------------------------------------
| POST /api/auth/register
*/

export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password } = req.body

    // Validate required fields
    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      })
      return
    }

    // Validate input types
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid registration data",
      })
      return
    }

    // Validate password
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      })
      return
    }

    // Normalize email
    const normalizedEmail = email
      .toLowerCase()
      .trim()

    // Check existing user
    const existingUser = await User.findOne({
      email: normalizedEmail,
    })

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "User with this email already exists",
      })
      return
    }

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      authProvider: "local",
    })

    // Generate JWT
    const token = generateToken(
      user._id.toString(),
      user.role
    )

    res.status(201).json({
      success: true,
      message: "Account created successfully",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
      },
    })
  } catch (error) {
    console.error("Register error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to create account",
    })
  }
}

/*
|--------------------------------------------------------------------------
| Login User
|--------------------------------------------------------------------------
| POST /api/auth/login
*/

export const loginUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      })
      return
    }

    // Validate input types
    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid login data",
      })
      return
    }

    // Normalize email
    const normalizedEmail = email
      .toLowerCase()
      .trim()

    /*
    |--------------------------------------------------------------------------
    | Find User
    |--------------------------------------------------------------------------
    | Password has select:false in User model.
    | Therefore +password is required here.
    */

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password")

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
      return
    }

    // Check account status
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "This account has been disabled",
      })
      return
    }

    // Google-only account protection
    if (
      user.authProvider === "google" &&
      !user.password
    ) {
      res.status(400).json({
        success: false,
        message: "Please continue with Google",
      })
      return
    }

    // Compare password with bcrypt hash
    const passwordMatches =
      await user.comparePassword(password)

    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
      return
    }

    // Update last login
    user.lastLoginAt = new Date()

    await user.save()

    // Generate fresh JWT
    const token = generateToken(
      user._id.toString(),
      user.role
    )

    res.status(200).json({
      success: true,
      message: "Login successful",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        lastLoginAt: user.lastLoginAt,
      },
    })
  } catch (error) {
    console.error("Login error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to login",
    })
  }
}

/*
|--------------------------------------------------------------------------
| Get Current User
|--------------------------------------------------------------------------
| GET /api/auth/me
| Protected Route
*/

export const getMe = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authRequest = req as import("../middleware/auth.middleware").AuthRequest

    if (!authRequest.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    res.status(200).json({
      success: true,
      user: authRequest.user,
    })
  } catch (error) {
    console.error("Get current user error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to fetch user",
    })
  }
}

/*
|--------------------------------------------------------------------------
| Update Profile
|--------------------------------------------------------------------------
| PUT /api/auth/me
| Protected Route
*/

export const updateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authRequest = req as import("../middleware/auth.middleware").AuthRequest

    if (!authRequest.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    const userId = authRequest.user.id
    const { name, avatar } = req.body

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim() || name.trim().length < 2)
    ) {
      res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters",
      })
      return
    }

    if (
      avatar !== undefined &&
      (typeof avatar !== "string" || avatar.length > 500)
    ) {
      res.status(400).json({
        success: false,
        message: "Avatar must be a valid image URL",
      })
      return
    }

    const user = await User.findById(userId)

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      })
      return
    }

    if (name !== undefined) {
      user.name = name.trim()
    }

    if (avatar !== undefined) {
      user.avatar = avatar.trim()
    }

    await user.save()

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
      },
    })
  } catch (error) {
    console.error("Update profile error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to update profile",
    })
  }
}

/*
|--------------------------------------------------------------------------
| Change Password
|--------------------------------------------------------------------------
| PUT /api/auth/password
| Protected Route
*/

export const changePassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authRequest = req as import("../middleware/auth.middleware").AuthRequest

    if (!authRequest.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    const { currentPassword, newPassword } = req.body

    if (typeof currentPassword !== "string" || !currentPassword) {
      res.status(400).json({
        success: false,
        message: "Current password is required",
      })
      return
    }

    if (
      typeof newPassword !== "string" ||
      newPassword.length < 8
    ) {
      res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      })
      return
    }

    if (newPassword === currentPassword) {
      res.status(400).json({
        success: false,
        message: "New password must be different from the current password",
      })
      return
    }

    // Password has select:false, so +password is required here.
    const user = await User.findById(authRequest.user.id).select("+password")

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      })
      return
    }

    // Google-only accounts have no password set.
    if (user.authProvider === "google" && !user.password) {
      res.status(400).json({
        success: false,
        message: "Password cannot be changed for Google-linked accounts",
      })
      return
    }

    const passwordMatches = await user.comparePassword(currentPassword)

    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      })
      return
    }

    user.password = newPassword
    await user.save()

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    })
  } catch (error) {
    console.error("Change password error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to change password",
    })
  }
}