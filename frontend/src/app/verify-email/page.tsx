"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { verifyEmail } from "@/features/auth/auth.service"

type Status = "verifying" | "success" | "error"

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>("verifying")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token")

    if (!token) {
      setStatus("error")
      setMessage("Missing verification token. Open the full link from your email.")
      return
    }

    verifyEmail(token)
      .then((result) => {
        setStatus("success")
        setMessage(result.message || "Email verified successfully.")
      })
      .catch((error) => {
        setStatus("error")
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to verify email. The link may be invalid or expired."
        )
      })
  }, [])

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#212121", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 p-8 text-center"
        style={{ background: "#2f2f2f" }}
      >
        {status === "verifying" && (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-[#8e8e8e]" />
            <h1 className="mt-4 text-[18px] font-semibold text-[#ececec]">
              Verifying your email…
            </h1>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto size-10 text-[#19c37d]" />
            <h1 className="mt-4 text-[18px] font-semibold text-[#ececec]">
              Email verified
            </h1>
            <p className="mt-2 text-[13px] text-[#8e8e8e]">{message}</p>
            <Link
              href="/login"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white py-2.5 text-[14px] font-semibold text-black hover:bg-white/90 transition-colors"
            >
              Sign in
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto size-10 text-red-400" />
            <h1 className="mt-4 text-[18px] font-semibold text-[#ececec]">
              Verification failed
            </h1>
            <p className="mt-2 text-[13px] text-[#8e8e8e]">{message}</p>
            <Link
              href="/login"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white py-2.5 text-[14px] font-semibold text-black hover:bg-white/90 transition-colors"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
