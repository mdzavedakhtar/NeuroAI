"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Code2,
  FileText,
  Globe2,
  Play,
  Sparkles,
} from "lucide-react"

import { FaGithub, FaYoutube } from "react-icons/fa"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const sources = [
  { name: "PDF", icon: FileText },
  { name: "Website", icon: Globe2 },
  { name: "GitHub", icon: FaGithub },
  { name: "YouTube", icon: FaYoutube },
  { name: "Code", icon: Code2 },
]

export function HeroSection() {
  return (
    <section className="ns-gradient-bg relative overflow-hidden pt-16">
      <div className="ns-grid-bg absolute inset-0 opacity-60" />

      <div className="pointer-events-none absolute left-1/2 top-28 size-[500px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="ns-container relative">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col items-center justify-center py-20 text-center lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge
              variant="outline"
              className="mb-6 rounded-full bg-background/60 px-4 py-2 backdrop-blur"
            >
              <Sparkles className="mr-2 size-3.5 text-primary" />
              Enterprise Knowledge & Code Intelligence
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="max-w-5xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Turn your entire knowledge stack into{" "}
            <span className="ns-gradient-text">intelligence.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mt-6 max-w-3xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg md:text-xl"
          >
            Connect documents, websites, repositories, videos and enterprise
            knowledge. NeuroStack understands your sources, retrieves the right
            evidence and generates grounded AI answers.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row"
          >
           <Button
  size="lg"
  className="group h-12 px-6"
  nativeButton={false}
  render={<Link href="/register" />}
>
  Start building free
  <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
</Button>

          <Button
  size="lg"
  variant="outline"
  className="h-12 bg-background/60 px-6 backdrop-blur"
  nativeButton={false}
  render={<Link href="#demo" />}
>
  <Play className="mr-1 size-4" />
  See NeuroStack in action
</Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm"
          >
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" />
              No credit card
            </span>

            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" />
              Multi-source intelligence
            </span>

            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" />
              Evidence-backed answers
            </span>
          </motion.div>

          <motion.div
            id="demo"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="ns-glass ns-glow mt-14 w-full max-w-4xl overflow-hidden rounded-2xl text-left"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <BrainCircuit className="size-4 text-primary" />
                </div>

                <div>
                  <p className="text-sm font-medium">NeuroStack Intelligence</p>
                  <p className="text-xs text-muted-foreground">
                    Research Workspace
                  </p>
                </div>
              </div>

              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-500" />
                8 sources connected
              </span>
            </div>

            <div className="p-4 sm:p-6">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground sm:max-w-[70%]">
                Compare our authentication implementation with the security
                requirements in the architecture document.
              </div>

              <div className="mt-5 flex gap-3">
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BrainCircuit className="size-4 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-sm font-medium">NeuroStack AI</p>

                  <p className="text-sm leading-6 text-muted-foreground">
                    I found three relevant authentication requirements. Your
                    JWT middleware implements token validation correctly, but
                    the architecture document also requires session revocation
                    and role-based permission checks.
                  </p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Source 1</p>
                      <p className="mt-1 truncate text-xs font-medium">
                        architecture.pdf · p. 18
                      </p>
                    </div>

                    <div className="rounded-xl border bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Source 2</p>
                      <p className="mt-1 truncate text-xs font-medium">
                        auth.middleware.ts · L42
                      </p>
                    </div>

                    <div className="rounded-xl border bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Confidence</p>
                      <p className="mt-1 text-xs font-medium text-emerald-500">
                        94% grounded
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="mt-10">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Connect knowledge from anywhere
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {sources.map(({ name, icon: Icon }) => (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-full border bg-background/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur"
                >
                  <Icon className="size-4" />
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}