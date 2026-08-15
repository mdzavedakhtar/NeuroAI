"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, MessageSquare, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export function AppHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  const router = useRouter()

  return (
    <header className="h-14 flex items-center justify-between border-b border-white/[0.08] bg-[#212121] px-4 shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 p-2 rounded-lg text-[#8e8e8e] hover:text-[#ececec] hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          title="Back to Chat"
        >
          <ArrowLeft className="size-4" />
        </button>

        <div className="min-w-0">
          <h1 className="text-[14px] font-semibold text-[#ececec] leading-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-[11px] text-[#8e8e8e] leading-tight truncate">
              {description}
            </p>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => router.push("/dashboard")}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer",
            title === "Chat"
              ? "bg-white/10 text-[#ececec]"
              : "text-[#8e8e8e] hover:text-[#ececec] hover:bg-white/5"
          )}
        >
          <MessageSquare className="size-4" />
          <span className="hidden sm:inline">Chat</span>
        </button>

        <button
          onClick={() => router.push("/dashboard/settings")}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer",
            title === "Settings"
              ? "bg-white/10 text-[#ececec]"
              : "text-[#8e8e8e] hover:text-[#ececec] hover:bg-white/5"
          )}
        >
          <Settings className="size-4" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </nav>
    </header>
  )
}
