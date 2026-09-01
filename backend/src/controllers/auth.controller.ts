import { Request, Response } from "express"

import User from "../models/User"
import { generateToken } from "../utils/generateToken"
import {
  buildVerificationUrl,
  generateVerificationToken,
  hashVerificationToken,
  sendVerificationEmail,
} from "../utils/email"

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

    // --------------------------------------------------
    // EMAIL VERIFICATION
    // --------------------------------------------------

    const verificationToken = generateVerificationToken()

    user.verificationToken = hashVerificationToken(verificationToken)
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await user.save()

    const emailSent = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: verificationToken,
    })

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

      verificationEmailSent: emailSent,

      // Dev convenience — only returned when SMTP is not configured.
      devVerificationUrl: emailSent
        ? undefined
        : buildVerificationUrl(verificationToken),
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

    // Email verification gate (opt-in via REQUIRE_EMAIL_VERIFICATION=true)
    if (
      process.env.REQUIRE_EMAIL_VERIFICATION === "true" &&
      user.authProvider === "local" &&
      !user.isEmailVerified
    ) {
      res.status(403).json({
        success: false,
        message: "Please verify your email address before signing in",
        requiresVerification: true,
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

/*
|--------------------------------------------------------------------------
| Verify Email
|--------------------------------------------------------------------------
| POST /api/auth/verify-email
| Body: { token: string }
| Public route
*/

export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.body

    if (typeof token !== "string" || !token.trim()) {
      res.status(400).json({
        success: false,
        message: "Verification token is required",
      })
      return
    }

    const hashedToken = hashVerificationToken(token.trim())

    const user = await User.findOne({
      verificationToken: hashedToken,
    }).select("+verificationToken +verificationTokenExpires")

    if (!user) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired verification link",
      })
      return
    }

    if (
      user.verificationTokenExpires &&
      user.verificationTokenExpires.getTime() < Date.now()
    ) {
      res.status(400).json({
        success: false,
        message: "This verification link has expired. Request a new one.",
      })
      return
    }

    user.isEmailVerified = true
    user.emailVerifiedAt = new Date()
    user.verificationToken = undefined
    user.verificationTokenExpires = undefined

    await user.save()

    res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now sign in.",
    })
  } catch (error) {
    console.error("Verify email error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to verify email",
    })
  }
}

/*
|--------------------------------------------------------------------------
| Resend Verification Email
|--------------------------------------------------------------------------
| POST /api/auth/resend-verification
| Body: { email: string }
| Public route — always returns a generic success to avoid user enumeration.
*/

export const resendVerification = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body

    if (typeof email !== "string" || !email.trim()) {
      res.status(400).json({
        success: false,
        message: "Email is required",
      })
      return
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+verificationToken +verificationTokenExpires")

    if (!user || user.authProvider !== "local" || user.isEmailVerified) {
      // Deliberately generic — never reveal whether the account exists.
      res.status(200).json({
        success: true,
        message: "If the account exists, a new verification email has been sent.",
      })
      return
    }

    const verificationToken = generateVerificationToken()

    user.verificationToken = hashVerificationToken(verificationToken)
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await user.save()

    const emailSent = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: verificationToken,
    })

    res.status(200).json({
      success: true,
      message: "If the account exists, a new verification email has been sent.",
      verificationEmailSent: emailSent,
      devVerificationUrl: emailSent ? undefined : buildVerificationUrl(verificationToken),
    })
  } catch (error) {
    console.error("Resend verification error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to resend verification email",
    })
  }
}

/*
|--------------------------------------------------------------------------
| Google OAuth — Start
|--------------------------------------------------------------------------
| GET /api/auth/google
| Redirects the browser to Google's consent screen.
*/

export const googleAuth = async (
  req: Request,
  res: Response
): Promise<void> => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    res.status(503).json({
      success: false,
      message: "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
    })
    return
  }

  const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)

  res.cookie("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  })

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}

/*
|--------------------------------------------------------------------------
| Google OAuth — Callback
|--------------------------------------------------------------------------
| GET /api/auth/google/callback?code=...&state=...
| Exchanges the code, loads the profile, finds/creates the user, and
| redirects back to the frontend with a JWT in the query string.
*/

export const googleCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    res.status(503).json({
      success: false,
      message: "Google sign-in is not configured.",
    })
    return
  }

  const { code, state, error } = req.query as {
    code?: string
    state?: string
    error?: string
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"

  const redirectToFrontend = (query: string) => {
    res.redirect(`${frontendUrl}/login${query}`)
  }

  if (error || !code) {
    redirectToFrontend("?error=" + encodeURIComponent(error || "google_denied"))
    return
  }

  const storedState = req.cookies?.google_oauth_state as string | undefined
  res.clearCookie("google_oauth_state")

  if (!storedState || storedState !== state) {
    redirectToFrontend("?error=invalid_state")
    return
  }

  const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`

  try {
    // 1. Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string
      error?: string
    }

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("[GOOGLE] Token exchange failed:", tokenData.error || tokenResponse.statusText)
      redirectToFrontend("?error=token_exchange_failed")
      return
    }

    // 2. Load the user profile
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    const profile = (await profileResponse.json()) as {
      sub?: string
      email?: string
      name?: string
      picture?: string
      email_verified?: boolean
    }

    if (!profileResponse.ok || !profile.sub || !profile.email) {
      redirectToFrontend("?error=profile_fetch_failed")
      return
    }

    // 3. Find existing user by googleId, then by email
    let user = await User.findOne({ googleId: profile.sub })

    if (!user) {
      user = await User.findOne({ email: profile.email.toLowerCase() })

      if (user) {
        // Link the Google identity to the existing local account.
        user.googleId = profile.sub
        user.authProvider = "google"
        user.avatar = profile.picture || user.avatar
        user.isEmailVerified = user.isEmailVerified || Boolean(profile.email_verified)
        await user.save()
      }
    }

    // 4. Create a new account for first-time Google users
    if (!user) {
      user = await User.create({
        name: profile.name || profile.email.split("@")[0],
        email: profile.email.toLowerCase(),
        authProvider: "google",
        googleId: profile.sub,
        avatar: profile.picture || "",
        isEmailVerified: Boolean(profile.email_verified),
        emailVerifiedAt: profile.email_verified ? new Date() : undefined,
      })
    }

    // 5. Issue JWT and hand it to the frontend
    const token = generateToken(user._id.toString(), user.role)
    redirectToFrontend(`?token=${encodeURIComponent(token)}`)
  } catch (error) {
    console.error("[GOOGLE] OAuth callback error:", error)
    redirectToFrontend("?error=oauth_failed")
  }
}