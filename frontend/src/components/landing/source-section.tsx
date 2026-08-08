"use client"

import { motion } from "framer-motion"
import {
  Braces,
  FileImage,
  FileSpreadsheet,
  FileText,
  Globe2,
  Presentation,
  ScanText,
} from "lucide-react"
import { FaGithub, FaYoutube } from "react-icons/fa"

const sources = [
  {
    title: "PDF",
    description: "Research papers, reports, manuals and enterprise documents.",
    icon: FileText,
  },
  {
    title: "DOCX",
    description: "Word documents, policies, notes and internal documentation.",
    icon: FileText,
  },
  {
    title: "PowerPoint",
    description: "Extract knowledge from presentations, decks and slides.",
    icon: Presentation,
  },
  {
    title: "Excel",
    description: "Understand structured spreadsheets and tabular information.",
    icon: FileSpreadsheet,
  },
  {
    title: "Website",
    description: "Turn web pages and documentation sites into searchable knowledge.",
    icon: Globe2,
  },
  {
    title: "GitHub",
    description: "Understand repositories, architecture, files and source code.",
    icon: FaGithub,
  },
  {
    title: "YouTube",
    description: "Convert video transcripts into searchable AI knowledge.",
    icon: FaYoutube,
  },
  {
    title: "Images & OCR",
    description: "Extract text and knowledge from screenshots and scanned images.",
    icon: ScanText,
  },
  {
    title: "Code Files",
    description: "Analyze source files across multiple programming languages.",
    icon: Braces,
  },
]

export function SourceSection() {
  return (
    <section className="relative border-t border-border/50 py-24 sm:py-28">
      <div className="ns-container">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <FileImage className="size-3.5 text-primary" />
            Universal Knowledge Ingestion
          </div>

          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Your knowledge lives everywhere.
            <span className="ns-gradient-text"> NeuroStack connects it.</span>
          </h2>

          <p className="mt-5 text-pretty leading-7 text-muted-foreground sm:text-lg">
            Bring documents, repositories, websites, videos and visual content
            into one intelligent workspace without changing how your team
            already works.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source, index) => {
            const Icon = source.icon

            return (
              <motion.div
                key={source.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.04,
                }}
                className="ns-card-hover group rounded-2xl border bg-card/60 p-5"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl border bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>

                <h3 className="font-semibold">{source.title}</h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {source.description}
                </p>
              </motion.div>
            )
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <div className="rounded-full border bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
            One workspace • Multiple formats • One intelligence layer
          </div>
        </div>
      </div>
    </section>
  )
}