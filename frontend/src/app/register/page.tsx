"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, ExternalLink, Loader2, MailCheck, ShieldCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { register, startGoogleLogin } from "@/features/auth/auth.service"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [verificationLink, setVerificationLink] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim() || !email.trim() || !password) {
      toast.error("Please fill in all required fields.")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }

    try {
      setLoading(true)
      const result = await register({ name: name.trim(), email: email.trim(), password })
      toast.success("Account created successfully!")

      if (result.devVerificationUrl) {
        setVerificationLink(result.devVerificationUrl)
        return
      }

      if (result.token) {
        router.replace("/dashboard")
      } else {
        router.replace("/login")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create account.")
    } finally {
      setLoading(false)
    }
  }

  function handleGoogle() {
    startGoogleLogin()
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[#090a0f] text-[#ececec] overflow-hidden select-none">
      {/* Dynamic Background Ambient Lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-emerald-500/20 via-teal-500/15 to-indigo-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="relative inline-flex items-center justify-center size-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 p-[1px] shadow-xl shadow-emerald-500/25 mb-4 group hover:scale-105 transition-transform duration-300">
            <div className="size-full bg-[#0d0f14] rounded-[15px] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-7.505-3.348 10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.504 3.347 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813z"
                  fill="#10b981"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Create your account
            <Sparkles className="size-4 text-emerald-400" />
          </h1>
          <p className="mt-1.5 text-xs text-gray-400">
            Get started with NeuroStack AI document intelligence platform
          </p>
        </div>

        {/* Glass Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-7 shadow-2xl shadow-emerald-950/20">
          {/* Google Sign Up */}
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/25 transition-all flex items-center justify-center gap-3 cursor-pointer group shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.4 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.4 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">
              OR REGISTER WITH EMAIL
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {verificationLink ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <MailCheck className="size-5 text-emerald-400 shrink-0" />
                <p className="text-sm font-semibold text-white">
                  Almost there — verify your email
                </p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-300">
                Development mode active: click your link below to complete verification:
              </p>
              <a
                href={verificationLink}
                className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-400 hover:underline break-all bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20"
              >
                <ExternalLink className="size-3.5 shrink-0" />
                {verificationLink}
              </a>
              <button
                onClick={() => router.replace("/dashboard")}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-bold text-black hover:brightness-110 transition-all cursor-pointer shadow-md"
              >
                Continue to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="name" className="block text-xs font-medium text-gray-300">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#12141a] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-medium text-gray-300">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#12141a] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-gray-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#12141a] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-black" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Free Account
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 hover:underline font-semibold">
            Sign in
          </Link>
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-gray-500">
          <ShieldCheck className="size-3.5 text-emerald-500/70" />
          <span>Enterprise-grade document security & privacy</span>
        </div>
      </div>
    </main>
  )
}
