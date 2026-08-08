"use client"

import {
  useEffect,
  useState,
} from "react"

import {
  useRouter,
} from "next/navigation"

import {
  BrainCircuit,
} from "lucide-react"

import {
  getToken,
} from "@/services/api"

export function AuthGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  const [ready, setReady] =
    useState(false)

  useEffect(() => {
    const token = getToken()

    if (!token) {
      router.replace("/login")
      return
    }

    setReady(true)
  }, [router])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="size-5 animate-pulse" />
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Loading NeuroStack...
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}