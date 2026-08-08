import Link from "next/link"
import { BrainCircuit } from "lucide-react"

import { cn } from "@/lib/utils"

interface NeuroStackLogoProps {
  className?: string
  showText?: boolean
}

export function NeuroStackLogo({
  className,
  showText = true,
}: NeuroStackLogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2.5 font-semibold tracking-tight",
        className
      )}
      aria-label="NeuroStack AI home"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <BrainCircuit className="size-5" />
      </span>

      {showText && (
        <span className="text-lg">
          NeuroStack
          <span className="ns-gradient-text ml-1">AI</span>
        </span>
      )}
    </Link>
  )
}