import {
  apiFetch,
  getToken,
  removeToken,
  setToken,
} from "@/services/api"

import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
} from "./auth.types"

export async function login(
  payload: LoginPayload
) {
  const result =
    await apiFetch<AuthResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    )

  if (!result.token) {
    throw new Error(
      "Login succeeded but no token was returned."
    )
  }

  setToken(result.token)

  if (
    typeof window !== "undefined" &&
    result.user
  ) {
    localStorage.setItem(
      "neurostack_user",
      JSON.stringify(result.user)
    )
  }

  return result
}

export async function register(
  payload: RegisterPayload
) {
  const result =
    await apiFetch<AuthResponse>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    )

  if (result.token) {
    setToken(result.token)
  }

  if (
    typeof window !== "undefined" &&
    result.user
  ) {
    localStorage.setItem(
      "neurostack_user",
      JSON.stringify(result.user)
    )
  }

  return result
}

export async function updateProfile(
  payload: {
    name?: string
    avatar?: string
  }
) {
  const result =
    await apiFetch<{
      success: boolean
      message: string
      user?: {
        id?: string
        name?: string
        email?: string
        avatar?: string
        role?: string
      }
    }>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    })

  if (
    typeof window !== "undefined" &&
    result.user
  ) {
    const stored = localStorage.getItem(
      "neurostack_user"
    )

    let current: Record<string, unknown> = {}

    if (stored) {
      try {
        current = JSON.parse(stored)
      } catch {
        // ignore
      }
    }

    localStorage.setItem(
      "neurostack_user",
      JSON.stringify({
        ...current,
        name: result.user.name ?? current.name,
        avatar: result.user.avatar ?? current.avatar,
      })
    )
  }

  return result
}

export async function changePassword(payload: {
  currentPassword: string
  newPassword: string
}) {
  return apiFetch<{
    success: boolean
    message: string
  }>("/auth/password", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function getMe() {
  return apiFetch<{
    success: boolean
    user?: User
  }>("/auth/me")
}

export async function verifyEmail(
  token: string
) {
  return apiFetch<{
    success: boolean
    message: string
  }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  })
}

export async function resendVerification(
  email: string
) {
  return apiFetch<{
    success: boolean
    message: string
    verificationEmailSent?: boolean
    devVerificationUrl?: string
  }>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

// Google OAuth — redirect the browser to the backend consent flow.
export function startGoogleLogin() {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:5000/api"

  window.location.href = `${apiUrl}/auth/google`
}

export function logout() {
  removeToken()

  if (typeof window !== "undefined") {
    localStorage.removeItem(
      "neurostack_user"
    )
  }
}

export function isAuthenticated() {
  return Boolean(getToken())
}