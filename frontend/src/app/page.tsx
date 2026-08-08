"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function Home() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [typedText, setTypedText] = useState("")
  const phrases = [
    "Chat with your Documents",
    "Ask anything, Instantly",
    "RAG-Powered Intelligence",
    "Your Private AI Assistant",
  ]
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  // Typewriter effect
  useEffect(() => {
    const current = phrases[phraseIndex]
    const speed = isDeleting ? 40 : 80

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setTypedText(current.slice(0, charIndex + 1))
        setCharIndex((c) => c + 1)
        if (charIndex + 1 === current.length) {
          setTimeout(() => setIsDeleting(true), 1800)
        }
      } else {
        setTypedText(current.slice(0, charIndex - 1))
        setCharIndex((c) => c - 1)
        if (charIndex - 1 === 0) {
          setIsDeleting(false)
          setPhraseIndex((i) => (i + 1) % phrases.length)
        }
      }
    }, speed)

    return () => clearTimeout(timeout)
  }, [charIndex, isDeleting, phraseIndex])

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = []
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
      })
    }

    let animId: number

    function animate() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(25, 195, 125, ${p.opacity})`
        ctx.fill()
      })

      // Draw connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 100) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(25, 195, 125, ${0.08 * (1 - dist / 100)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white overflow-hidden" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Radial glow background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-[#19c37d]/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#6366f1]/8 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-[#19c37d] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-[17px] text-white tracking-tight">NeuroStack AI</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-[14px] text-[#8e8e8e]">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#tech" className="hover:text-white transition-colors">Tech Stack</a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-[14px] text-[#8e8e8e] hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-[14px] font-semibold bg-[#19c37d] hover:bg-[#17b371] text-black px-5 py-2 rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 md:pt-36 md:pb-28">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#19c37d]/30 bg-[#19c37d]/10 text-[#19c37d] text-[12px] font-medium mb-8">
          <span className="size-1.5 rounded-full bg-[#19c37d] animate-pulse" />
          Powered by Gemini AI + Pinecone RAG
        </div>

        <h1 className="text-[42px] md:text-[72px] font-bold leading-[1.05] tracking-tight max-w-4xl mx-auto text-white mb-6">
          The AI that knows
          <br />
          <span className="text-[#19c37d]">
            {typedText}
            <span className="animate-pulse">|</span>
          </span>
        </h1>

        <p className="text-[17px] md:text-[18px] text-[#8e8e8e] leading-relaxed max-w-2xl mx-auto mb-10">
          Upload your documents — PDFs, Word files, Excel sheets — and have intelligent conversations with your private knowledge base. No hallucinations. Just grounded answers.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/register"
            className="flex items-center gap-2 bg-white text-black font-semibold px-7 py-3.5 rounded-xl hover:bg-white/90 transition-all text-[15px] shadow-xl"
          >
            Start for Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 text-[15px] text-[#8e8e8e] hover:text-white transition-colors px-7 py-3.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5"
          >
            Sign In to Dashboard
          </Link>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 mt-16 pt-10 border-t border-white/[0.06] w-full max-w-2xl">
          {[
            { label: "File Types Supported", value: "4+" },
            { label: "Vector Search", value: "Pinecone" },
            { label: "AI Engine", value: "Gemini" },
            { label: "Response Mode", value: "Real-time" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-[22px] font-bold text-white">{stat.value}</div>
              <div className="text-[12px] text-[#8e8e8e] mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 px-6 md:px-12 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-[32px] md:text-[42px] font-bold text-white mb-4">
            Enterprise-grade Features
          </h2>
          <p className="text-[16px] text-[#8e8e8e] max-w-xl mx-auto">
            Built for teams who need reliable, grounded AI answers from their private documents.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: "📄",
              title: "Multi-Format Uploads",
              desc: "Support for PDF, DOCX, XLSX, and PPTX. Every document type is parsed, chunked, and indexed instantly.",
              color: "#19c37d",
            },
            {
              icon: "🧠",
              title: "RAG-Powered Answers",
              desc: "Retrieval Augmented Generation ensures every answer is grounded in your actual documents with cited sources.",
              color: "#6366f1",
            },
            {
              icon: "⚡",
              title: "Real-Time Streaming",
              desc: "Responses stream token-by-token using Server-Sent Events for an instant, ChatGPT-like experience.",
              color: "#f59e0b",
            },
            {
              icon: "🎯",
              title: "Smart Model Selection",
              desc: "Switch between Gemini 2.0 Flash for speed and Gemini 1.5 Pro for deep reasoning mid-conversation.",
              color: "#ec4899",
            },
            {
              icon: "📚",
              title: "Document Library",
              desc: "Manage all your knowledge sources in one place. Attach any document to any conversation.",
              color: "#14b8a6",
            },
            {
              icon: "🔒",
              title: "Private & Secure",
              desc: "JWT-based auth, per-user isolation, and secure Pinecone vector namespacing keep your data private.",
              color: "#f97316",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all cursor-default"
            >
              <div
                className="size-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: `${feature.color}18` }}
              >
                {feature.icon}
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-[13.5px] text-[#8e8e8e] leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 px-6 md:px-12 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-[32px] md:text-[42px] font-bold text-white mb-4">
            How it works
          </h2>
          <p className="text-[16px] text-[#8e8e8e]">
            Three steps from signup to AI-powered answers.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {[
            {
              step: "01",
              title: "Upload your Document",
              desc: "Drop a PDF, DOCX, XLSX or PPTX file. NeuroStack parses, chunks and indexes it into Pinecone in seconds.",
            },
            {
              step: "02",
              title: "Start a Conversation",
              desc: "Attach the document and ask any question. Semantic search retrieves the most relevant context chunks.",
            },
            {
              step: "03",
              title: "Get Grounded Answers",
              desc: "Gemini generates an answer grounded strictly in your document, with source references shown inline.",
            },
          ].map((item, i) => (
            <div key={item.step} className="flex items-start gap-6 p-6 rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              <div className="shrink-0 text-[32px] font-black text-[#19c37d]/30 leading-none w-12">{item.step}</div>
              <div>
                <h3 className="text-[16px] font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-[14px] text-[#8e8e8e] leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech" className="relative z-10 px-6 md:px-12 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-[28px] md:text-[36px] font-bold text-white mb-3">
            Built with best-in-class tools
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: "Next.js 15", role: "Frontend Framework", emoji: "▲" },
            { name: "Gemini AI", role: "Language Model", emoji: "✦" },
            { name: "Pinecone", role: "Vector Database", emoji: "◈" },
            { name: "MongoDB", role: "Document Database", emoji: "◉" },
            { name: "Express.js", role: "Backend API", emoji: "⬡" },
            { name: "Mammoth", role: "DOCX Parsing", emoji: "⌁" },
            { name: "XLSX.js", role: "Excel Parsing", emoji: "⊞" },
            { name: "pdf-parse", role: "PDF Parsing", emoji: "⊗" },
          ].map((tech) => (
            <div
              key={tech.name}
              className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all text-center"
            >
              <div className="text-[22px] mb-2 text-[#19c37d]">{tech.emoji}</div>
              <div className="text-[13px] font-semibold text-white">{tech.name}</div>
              <div className="text-[11px] text-[#8e8e8e] mt-0.5">{tech.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 md:px-12 py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="p-10 md:p-14 rounded-3xl border border-[#19c37d]/20 bg-[#19c37d]/[0.04] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#19c37d]/5 via-transparent to-[#6366f1]/5 pointer-events-none" />
            <h2 className="relative text-[28px] md:text-[38px] font-bold text-white mb-4 leading-tight">
              Ready to chat with<br />your documents?
            </h2>
            <p className="relative text-[15px] text-[#8e8e8e] mb-8">
              Join and experience the next generation of document intelligence.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-[#19c37d] hover:bg-[#17b371] text-black font-bold px-8 py-4 rounded-xl transition-all text-[15px] shadow-lg shadow-[#19c37d]/20"
            >
              Create Free Account
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 md:px-12 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-[#8e8e8e]">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded bg-[#19c37d] flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span>NeuroStack AI — 2026</span>
        </div>
        <span>Built with Next.js · Gemini · Pinecone · MongoDB</span>
      </footer>
    </div>
  )
}