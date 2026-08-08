"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { register } from "@/features/auth/auth.service"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim() || !email.trim() || !password) {
      toast.error("Complete all fields.")
      return
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }

    try {
      setLoading(true)
      const result = await register({ name: name.trim(), email: email.trim(), password })
      toast.success("Account created successfully.")
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
        <h1 className="text-[22px] font-semibold text-[#ececec]">Create your account</h1>
      </div>

      {/* Form Card */}
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 p-6"
        style={{ background: "#2f2f2f" }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-[13px] font-medium text-[#ececec]">
              Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Your name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#212121] px-4 py-2.5 text-[14px] text-[#ececec] placeholder-[#8e8e8e] outline-none focus:border-white/30 transition-colors"
            />
          </div>

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
              autoComplete="new-password"
              placeholder="Minimum 6 characters"
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
                Creating account...
              </>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      </div>

      <p className="mt-5 text-[13px] text-[#8e8e8e]">
        Already have an account?{" "}
        <Link href="/login" className="text-[#ececec] hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </main>
  )
}