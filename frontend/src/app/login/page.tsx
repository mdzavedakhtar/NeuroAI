"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUp, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  getMe,
  login,
  startGoogleLogin,
} from "@/features/auth/auth.service"
import { setToken } from "@/services/api"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)

  // Handle Google OAuth callback (token) and error redirects.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get("error")
    const token = params.get("token")

    if (error) {
      const message =
        error === "google_denied"
          ? "Google sign-in was cancelled."
          : error === "invalid_state"
            ? "Google sign-in expired. Please try again."
            : "Google sign-in failed. Please try again."
      toast.error(message)
      window.history.replaceState({}, "", "/login")
    }

    if (token) {
      setOauthLoading(true)
      setToken(token)

      getMe()
        .then((response) => {
          if (response.user) {
            localStorage.setItem(
              "neurostack_user",
              JSON.stringify(response.user)
            )
          }
          router.replace("/dashboard")
        })
        .catch(() => {
          setOauthLoading(false)
          toast.error("Google sign-in failed. Please try again.")
          window.history.replaceState({}, "", "/login")
        })
    }
  }, [router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      toast.error("Enter your email address.")
      return
    }
    if (!password) {
      toast.error("Enter your password.")
      return
    }

    try {
      setLoading(true)
      await login({ email: email.trim(), password })
      router.replace("/dashboard")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.")
    } finally {
      setLoading(false)
    }
  }

  function handleGoogle() {
    startGoogleLogin()
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#212121", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center size-10 rounded-full bg-white mb-4">
          <svg width="20" height="20" viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-7.505-3.348 10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.504 3.347 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813z" fill="#000"/>
          </svg>
        </div>
        <h1 className="text-[22px] font-semibold text-[#ececec]">Welcome back</h1>
      </div>

      {/* Form Card */}
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 p-6"
        style={{ background: "#2f2f2f" }}
      >
        {/* Google sign-in */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={oauthLoading}
          className="w-full rounded-xl border border-white/15 bg-white py-2.5 text-[14px] font-semibold text-[#1a1a1a] hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
        >
          {oauthLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.4 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.4 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
            </svg>
          )}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] uppercase tracking-wider text-[#8e8e8e]">
            or
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[13px] font-medium text-[#ececec]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#212121] px-4 py-2.5 text-[14px] text-[#ececec] placeholder-[#8e8e8e] outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-[13px] font-medium text-[#ececec]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#212121] px-4 py-2.5 text-[14px] text-[#ececec] placeholder-[#8e8e8e] outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white py-2.5 text-[14px] font-semibold text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Continue
                <ArrowUp className="size-4" />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="mt-5 text-[13px] text-[#8e8e8e]">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-[#ececec] hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </main>
  )
}
