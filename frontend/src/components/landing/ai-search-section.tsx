"use client"

import { motion } from "framer-motion"
import {
  BrainCircuit,
  CheckCircle2,
  Database,
  FileSearch,
  Layers3,
  MessageSquareText,
  Search,
  Sparkles,
} from "lucide-react"

const pipeline = [
  {
    title: "Question",
    description: "Understand user intent",
    icon: MessageSquareText,
  },
  {
    title: "Embedding",
    description: "Convert query to vectors",
    icon: Sparkles,
  },
  {
    title: "Semantic Search",
    description: "Find relevant knowledge",
    icon: Search,
  },
  {
    title: "Vector DB",
    description: "Search indexed sources",
    icon: Database,
  },
  {
    title: "Top-K Evidence",
    description: "Retrieve best context",
    icon: Layers3,
  },
  {
    title: "Grounded Answer",
    description: "Generate with citations",
    icon: BrainCircuit,
  },
]

export function AISearchSection() {
  return (
    <section
      id="ai-search"
      className="relative overflow-hidden border-t border-border/50 py-24 sm:py-28"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />

      <div className="ns-container relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <FileSearch className="size-3.5 text-primary" />
            AI Search Engine
          </div>

          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Ask once. Search everything.
            <span className="ns-gradient-text"> Answer with evidence.</span>
          </h2>

          <p className="mt-5 text-pretty leading-7 text-muted-foreground sm:text-lg">
            NeuroStack retrieves relevant information from your connected
            knowledge before generating an answer, helping responses stay
            grounded in your actual sources.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pipeline.map((step, index) => {
            const Icon = step.icon

            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.06,
                }}
                className="relative rounded-2xl border bg-card/60 p-5"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>

                  <span className="text-xs font-medium text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>

                <h3 className="font-semibold">{step.title}</h3>

                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="ns-glass ns-glow mt-10 overflow-hidden rounded-2xl"
        >
          <div className="border-b border-border/60 px-5 py-4">
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-4 text-primary" />

              <span className="text-sm font-medium">
                Retrieval Intelligence
              </span>
            </div>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.2fr] lg:p-7">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Question
              </p>

              <div className="mt-3 rounded-xl border bg-background/60 p-4 text-sm leading-6">
                What security requirements are missing from our authentication
                implementation?
              </div>

              <div className="mt-5 space-y-3">
                <RetrievalStatus
                  label="Query embedding generated"
                  value="768 dimensions"
                />

                <RetrievalStatus
                  label="Knowledge sources searched"
                  value="12 sources"
                />

                <RetrievalStatus
                  label="Relevant evidence retrieved"
                  value="5 chunks"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Retrieved Evidence
                </p>

                <span className="text-xs text-emerald-500">
                  High confidence
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <Evidence
                  source="security-architecture.pdf"
                  location="Page 18"
                  score="96%"
                />

                <Evidence
                  source="auth.middleware.ts"
                  location="Lines 42–71"
                  score="93%"
                />

                <Evidence
                  source="api-security.md"
                  location="Section 4.2"
                  score="89%"
                />
              </div>

              <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />

                  <div>
                    <p className="text-sm font-medium">
                      Grounded response ready
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Answer generated from retrieved context with source-level
                      evidence and confidence signals.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function RetrievalStatus({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <CheckCircle2 className="size-4 text-emerald-500" />
        {label}
      </span>

      <span className="shrink-0 text-xs font-medium">{value}</span>
    </div>
  )
}

function Evidence({
  source,
  location,
  score,
}: {
  source: string
  location: string
  score: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-background/60 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{source}</p>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {location}
        </p>
      </div>

      <div className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
        {score}
      </div>
    </div>
  )
}