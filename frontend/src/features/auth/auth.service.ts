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