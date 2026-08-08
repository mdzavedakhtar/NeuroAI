"use client"

import { motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Braces,
  Bug,
  CheckCircle2,
  FileCode2,
  GitBranch,
  Network,
  SearchCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { FaGithub } from "react-icons/fa"

const capabilities = [
  {
    title: "Repository Q&A",
    description:
      "Ask questions across files, functions, modules and repository documentation.",
    icon: SearchCode,
  },
  {
    title: "AI Code Review",
    description:
      "Detect maintainability issues, risky patterns and improvement opportunities.",
    icon: Braces,
  },
  {
    title: "Security Analysis",
    description:
      "Surface authentication, authorization and code-level security concerns.",
    icon: ShieldCheck,
  },
  {
    title: "Bug Intelligence",
    description:
      "Trace suspicious logic and understand how issues can propagate across modules.",
    icon: Bug,
  },
  {
    title: "Dependency Intelligence",
    description:
      "Understand relationships between modules, packages, imports and services.",
    icon: Network,
  },
  {
    title: "Architecture Mapping",
    description:
      "Turn large repositories into an understandable map of components and flows.",
    icon: Boxes,
  },
]

const repoFiles = [
  { name: "src", type: "folder", level: 0 },
  { name: "middleware", type: "folder", level: 1 },
  { name: "auth.middleware.ts", type: "file", level: 2, active: true },
  { name: "controllers", type: "folder", level: 1 },
  { name: "auth.controller.ts", type: "file", level: 2 },
  { name: "services", type: "folder", level: 1 },
  { name: "auth.service.ts", type: "file", level: 2 },
  { name: "routes", type: "folder", level: 1 },
  { name: "auth.routes.ts", type: "file", level: 2 },
]

export function CodeIntelligenceSection() {
  return (
    <section
      id="code-intelligence"
      className="relative overflow-hidden border-t border-border/50 py-24 sm:py-28"
    >
      <div className="pointer-events-none absolute right-0 top-1/3 size-[500px] rounded-full bg-primary/5 blur-[130px]" />

      <div className="ns-container relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <FaGithub className="size-3.5 text-primary" />
            Repository Intelligence
          </div>

          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Understand the codebase.
            <span className="ns-gradient-text"> Not just the code.</span>
          </h2>

          <p className="mt-5 text-pretty leading-7 text-muted-foreground sm:text-lg">
            NeuroStack connects code, documentation and architecture context so
            developers can explore repositories, review implementation choices
            and understand how systems fit together.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((capability, index) => {
            const Icon = capability.icon

            return (
              <motion.div
                key={capability.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.05,
                }}
                className="ns-card-hover rounded-2xl border bg-card/60 p-5"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl border bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>

                <h3 className="font-semibold">{capability.title}</h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {capability.description}
                </p>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="ns-glass ns-glow mt-10 overflow-hidden rounded-2xl"
        >
          <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <FaGithub className="size-4 text-primary" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    neurostack/backend-api
                  </p>

                  <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                    main
                  </span>
                </div>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Repository Intelligence Workspace
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Indexed
              </span>

              <span>148 files</span>
              <span>32.4k LOC</span>
            </div>
          </div>

          <div className="grid min-h-[520px] lg:grid-cols-[220px_1fr_310px]">
            {/* Repository tree */}
            <div className="border-b border-border/60 p-4 lg:border-b-0 lg:border-r">
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <GitBranch className="size-3.5" />
                Repository
              </div>

              <div className="space-y-1">
                {repoFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                      file.active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground"
                    }`}
                    style={{
                      paddingLeft: `${8 + file.level * 12}px`,
                    }}
                  >
                    {file.type === "folder" ? (
                      <span className="text-[10px]">▾</span>
                    ) : (
                      <FileCode2 className="size-3.5 shrink-0" />
                    )}

                    <span className="truncate">{file.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Code viewer */}
            <div className="min-w-0 border-b border-border/60 lg:border-b-0 lg:border-r">
              <div className="flex h-11 items-center border-b border-border/60 px-4">
                <FileCode2 className="mr-2 size-3.5 text-primary" />

                <span className="truncate text-xs font-medium">
                  src/middleware/auth.middleware.ts
                </span>
              </div>

              <div className="overflow-x-auto p-4 font-mono text-xs leading-7">
                <CodeLine number="38">
                  {"export const authenticate = async (req, res, next) => {"}
                </CodeLine>

                <CodeLine number="39">
                  {"  const token = req.headers.authorization?.split(' ')[1]"}
                </CodeLine>

                <CodeLine number="40">{" "}</CodeLine>

                <CodeLine number="41">
                  {"  if (!token) {"}
                </CodeLine>

                <CodeLine number="42" highlight>
                  {"    return res.status(401).json({ message: 'Unauthorized' })"}
                </CodeLine>

                <CodeLine number="43">
                  {"  }"}
                </CodeLine>

                <CodeLine number="44">{" "}</CodeLine>

                <CodeLine number="45">
                  {"  const decoded = jwt.verify(token, process.env.JWT_SECRET!)"}
                </CodeLine>

                <CodeLine number="46">
                  {"  req.user = decoded"}
                </CodeLine>

                <CodeLine number="47">
                  {"  next()"}
                </CodeLine>

                <CodeLine number="48">
                  {"}"}
                </CodeLine>
              </div>

              <div className="mx-4 mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />

                  <div>
                    <p className="text-sm font-medium">
                      Session revocation is not checked
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Valid JWTs remain usable until expiration even if the
                      session has been revoked elsewhere.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI analysis */}
            <div className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />

                <p className="text-sm font-medium">AI Review</p>
              </div>

              <div className="space-y-3">
                <Finding
                  type="Security"
                  title="Missing revocation check"
                  severity="High"
                />

                <Finding
                  type="Reliability"
                  title="JWT verification needs error handling"
                  severity="Medium"
                />

                <Finding
                  type="Architecture"
                  title="RBAC validation not present"
                  severity="Medium"
                />
              </div>

              <div className="mt-5 rounded-xl border bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Suggested improvement
                </p>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Validate the session identifier against the revocation store
                  before attaching the decoded user to the request.
                </p>

                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary"
                >
                  View suggested patch
                  <ArrowRight className="size-3" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric label="Security" value="82%" />
                <Metric label="Quality" value="91%" />
                <Metric label="Coverage" value="76%" />
                <Metric label="Maintainability" value="88%" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function CodeLine({
  number,
  children,
  highlight = false,
}: {
  number: string
  children: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex min-w-max ${
        highlight ? "bg-amber-500/10" : ""
      }`}
    >
      <span className="mr-5 w-7 shrink-0 select-none text-right text-muted-foreground/50">
        {number}
      </span>

      <code className="pr-5 text-muted-foreground">
        {children || " "}
      </code>
    </div>
  )
}

function Finding({
  type,
  title,
  severity,
}: {
  type: string
  title: string
  severity: "High" | "Medium"
}) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {type}
        </span>

        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            severity === "High"
              ? "bg-red-500/10 text-red-500"
              : "bg-amber-500/10 text-amber-500"
          }`}
        >
          {severity}
        </span>
      </div>

      <p className="mt-2 text-xs font-medium">{title}</p>
    </div>
  )
}

function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}