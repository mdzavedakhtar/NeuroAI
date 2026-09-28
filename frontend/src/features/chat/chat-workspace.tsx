"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  ChevronDown,
  Copy,
  Database,
  FileText,
  Loader2,
  LogOut,
  Paperclip,
  Send,
  Settings,
  Share2,
  Trash2,
  X,
  Code,
  BarChart3,
  Sparkles,
  Pencil,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createConversation,
  deleteConversation,
  getConversations,
  getMessages,
  sendMessage,
  updateConversation,
} from "./chat.service"
import {
  uploadKnowledge,
  indexKnowledge,
  extractKnowledgeId,
  getKnowledgeStatus,
} from "@/features/knowledge/knowledge.service"
import {
  logout,
  resendVerification,
} from "@/features/auth/auth.service"
import { getToken } from "@/services/api"
import { ManageDocumentsModal } from "./manage-documents-modal"
import { CitationBadge } from "./CitationBadge"
import { FeedbackButtons } from "./FeedbackButtons"
import { cn } from "@/lib/utils"
import type { ChatMessage, Conversation } from "./chat.types"

export function ChatWorkspace() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false) // default closed on mobile
  const [isMobile, setIsMobile] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // PDF Attachment State
  const [attachment, setAttachment] = useState<{
    file: File
    knowledgeId: string
    status: "uploading" | "indexing" | "ready" | "error"
    progressMessage: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Document Library Modal State
  const [docModalOpen, setDocModalOpen] = useState(false)

  // Streaming/Typing Animation State
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const [streamingSources, setStreamingSources] = useState<any[]>([])

  const [activeModel, setActiveModel] = useState<string>("gemini-2.0-flash")
  const abortControllerRef = useRef<AbortController | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const [userProfile, setUserProfile] = useState<{
    name?: string
    email?: string
    isEmailVerified?: boolean
  } | null>(null)

  // Detect mobile and set initial sidebar state
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) {
        setSidebarOpen(true)
      }
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const u = localStorage.getItem("neurostack_user")
      if (u) {
        try {
          setUserProfile(JSON.parse(u))
        } catch {
          // ignore
        }
      }
    }
    void loadConversations()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, streamingText])

  async function loadConversations() {
    try {
      setLoadingHistory(true)
      const response = await getConversations()
      setConversations(response.conversations)
    } catch {
      toast.error("Unable to load chat history.")
    } finally {
      setLoadingHistory(false)
    }
  }

  async function handleSelectConversation(conv: Conversation) {
    if (sendingRef.current) return
    try {
      setActiveConversation(conv)
      setStreamingText("")
      setIsStreaming(false)
      setStreamingMsgId(null)
      setAttachment(null)
      const response = await getMessages(conv._id)
      setMessages(response.messages)
    } catch {
      toast.error("Unable to load messages.")
    }
  }

  async function handleNewChat() {
    if (sendingRef.current) return
    setActiveConversation(null)
    setMessages([])
    setStreamingText("")
    setIsStreaming(false)
    setStreamingMsgId(null)
    setAttachment(null)
    setInput("")
  }

  // Inline Rename State
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  function handleStartRename(conv: Conversation, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingChatId(conv._id)
    setEditingTitle(conv.title)
  }

  async function handleSaveRename(convId: string, e?: React.FormEvent) {
    if (e) e.preventDefault()
    const trimmed = editingTitle.trim()
    if (!trimmed) {
      setEditingChatId(null)
      return
    }
    try {
      await updateConversation(convId, trimmed)
      setConversations((prev) =>
        prev.map((c) => (c._id === convId ? { ...c, title: trimmed } : c))
      )
      if (activeConversation?._id === convId) {
        setActiveConversation((prev) => (prev ? { ...prev, title: trimmed } : prev))
      }
      toast.success("Chat renamed.")
    } catch {
      toast.error("Failed to rename chat.")
    } finally {
      setEditingChatId(null)
    }
  }

  async function handleDeleteChat(conv: Conversation, e: React.MouseEvent) {
    e.stopPropagation()
    if (sendingRef.current) return
    try {
      await deleteConversation(conv._id)
      setConversations((curr) => curr.filter((c) => c._id !== conv._id))
      if (activeConversation?._id === conv._id) {
        handleNewChat()
      }
      toast.success("Chat deleted.")
    } catch {
      toast.error("Failed to delete chat.")
    }
  }

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedMimes = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ])
    const allowedExtensions = new Set([".pdf", ".docx", ".xlsx", ".pptx"])
    const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()

    if (!allowedMimes.has(file.type) && !allowedExtensions.has(extension)) {
      toast.error("Unsupported file format. Only PDF, DOCX, XLSX, and PPTX files are supported.")
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File exceeds 50 MB limit.")
      return
    }

    setAttachment({
      file,
      knowledgeId: "",
      status: "uploading",
      progressMessage: "Uploading file...",
    })

    try {
      const uploadRes = await uploadKnowledge(file)
      const knowledgeId = extractKnowledgeId(uploadRes)
      if (!knowledgeId) throw new Error("Could not upload file.")

      // Instantly mark attachment ready so user can send question without waiting
      setAttachment({ file, knowledgeId, status: "ready", progressMessage: "Ready" })
      toast.success(`${file.name} attached successfully.`)

      // Trigger background indexing
      indexKnowledge(knowledgeId).catch((err) => {
        console.warn("[ATTACHMENT] Background indexing trigger error:", err)
      })
    } catch (err: any) {
      console.error(err)
      setAttachment({ file, knowledgeId: "", status: "error", progressMessage: "Failed" })
      toast.error(err.message || `Failed to upload ${file.name}`)
    } finally {
      e.target.value = ""
    }
  }

  function startStreamingAnimation(messageId: string, fullText: string) {
    setIsStreaming(true)
    setStreamingMsgId(messageId)
    setStreamingText("")

    let currentLength = 0
    const speed = 7
    const interval = setInterval(() => {
      currentLength += 2
      if (currentLength >= fullText.length) {
        setStreamingText(fullText)
        setIsStreaming(false)
        setStreamingMsgId(null)
        clearInterval(interval)
      } else {
        setStreamingText(fullText.slice(0, currentLength))
      }
    }, speed)
  }

  async function handleSend() {
    const question = input.trim()
    if (!question || sendingRef.current) return

    if (attachment && attachment.status !== "ready") {
      toast.error("Please wait until the document is indexed.")
      return
    }

    sendingRef.current = true
    setLoading(true)
    setInput("")

    let conversation = activeConversation

    try {
      if (attachment && attachment.status === "ready") {
        const created = await createConversation(attachment.file.name, attachment.knowledgeId)
        conversation = created.conversation
        setActiveConversation(conversation)
        setConversations((curr) => [conversation!, ...curr])
        setMessages([])
        setAttachment(null)
      } else if (!conversation) {
        const created = await createConversation("New Chat")
        conversation = created.conversation
        setActiveConversation(conversation)
        setConversations((curr) => [conversation!, ...curr])
        setMessages([])
      }

      const userMsg: ChatMessage = { role: "user", content: question, sources: [] }
      setMessages((curr) => [...curr, userMsg])

      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
      const response = await fetch(`${apiUrl}/chat/conversations/${conversation!._id}/messages/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ message: question, model: activeModel }),
        signal,
      })

      if (!response.ok) {
        let errorMsg = "Failed to start message stream"
        try {
          const errData = await response.json()
          if (errData && errData.message) {
            errorMsg = errData.message
          }
        } catch {
          // ignore parsing error if response body is not JSON
        }
        toast.error(errorMsg)
        setIsStreaming(false)
        setStreamingText("")
        setStreamingSources([])
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) {
        toast.error("No response stream reader available")
        setIsStreaming(false)
        return
      }

      let accumulated = ""
      setIsStreaming(true)
      setStreamingText("")
      setStreamingSources([])

      // Read SSE stream
      let buffer = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        
        buffer = lines.pop() || ""

        for (const line of lines) {
          const cleanLine = line.trim()
          if (!cleanLine.startsWith("data: ")) continue

          const jsonStr = cleanLine.slice(6).trim()
          try {
            const data = JSON.parse(jsonStr)
            if (data.type === "meta") {
              if (data.sources) {
                setStreamingSources(data.sources)
              }
              setMessages((curr) => {
                const list = [...curr]
                if (list.length > 0 && list[list.length - 1].role === "user") {
                  list[list.length - 1] = data.userMessage
                }
                return list
              })
            } else if (data.type === "content") {
              accumulated += data.text
              setStreamingText(accumulated)
            } else if (data.type === "done") {
              setIsStreaming(false)
              setStreamingText("")
              setStreamingSources([])
              
              setMessages((curr) => [...curr, data.assistantMessage])
              
              if (data.conversation) {
                setActiveConversation(data.conversation)
              }
            } else if (data.type === "error") {
              toast.error(data.message || "Error generating response")
            }
          } catch (e) {
            // Ignore parse errors on partial chunks
          }
        }
      }

      const chats = await getConversations()
      setConversations(chats.conversations)
    } catch (err) {
      console.error(err)
      toast.error("Failed to generate answer.")
      setIsStreaming(false)
      setStreamingText("")
      setStreamingSources([])
    } finally {
      sendingRef.current = false
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  function handleStopGenerating() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setLoading(false)
    sendingRef.current = false
  }

  function handleExportChat() {
    if (messages.length === 0) {
      toast.error("No messages to export.")
      return
    }

    const title = activeConversation?.title || "Conversation"
    let markdown = `# ${title}\n\n`

    messages.forEach((msg) => {
      const roleName = msg.role === "assistant" ? "NeuroStack AI" : "You"
      markdown += `### ${roleName}\n${msg.content}\n\n`
    })

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Chat exported successfully!")
  }

  function groupConversations(conversations: Conversation[]) {
    const groups: { [key: string]: Conversation[] } = {
      Today: [],
      Yesterday: [],
      "Previous 7 Days": [],
      Older: [],
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    conversations.forEach((conv) => {
      const date = new Date(conv.updatedAt || conv.createdAt || "")
      if (date >= today) {
        groups.Today.push(conv)
      } else if (date >= yesterday) {
        groups.Yesterday.push(conv)
      } else if (date >= sevenDaysAgo) {
        groups["Previous 7 Days"].push(conv)
      } else {
        groups.Older.push(conv)
      }
    })

    return Object.keys(groups).reduce((acc, key) => {
      if (groups[key].length > 0) {
        acc[key] = groups[key]
      }
      return acc
    }, {} as { [key: string]: Conversation[] })
  }

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  async function handleResendVerification() {
    if (!userProfile?.email) {
      toast.error("No email address on file.")
      return
    }

    try {
      const result = await resendVerification(userProfile.email)
      toast.success(
        result.devVerificationUrl
          ? "Verification link ready — click the banner to open it."
          : result.message || "Verification email sent."
      )
    } catch {
      toast.error("Failed to resend verification email.")
    }
  }

  const userInitial = userProfile?.name?.charAt(0).toUpperCase() || "U"

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090a10] text-[#ececec]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      
      {/* Mobile sidebar backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================================================================
          SIDEBAR
          ================================================================ */}
      <aside
        className={cn(
          "bg-[#0e1017] border-r border-white/[0.08] h-full flex flex-col shrink-0 transition-all duration-300 ease-in-out z-30 overflow-hidden",
          isMobile
            ? cn("fixed top-0 left-0 h-full", sidebarOpen ? "w-[280px] shadow-2xl" : "w-0")
            : cn(sidebarOpen ? "w-[260px]" : "w-0")
        )}
      >
        {/* Sidebar Top Actions */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2.5 gap-1 border-b border-white/[0.06]">
          {/* Brand */}
          <div className="flex items-center gap-2 px-1">
            <div className="size-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Sparkles className="size-3.5 text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-white tracking-wide">NeuroStack AI</span>
          </div>

          <div className="flex items-center gap-1">
            {/* New Chat button */}
            <button
              onClick={handleNewChat}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="New chat"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>

            {/* Toggle sidebar close */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close sidebar"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversations History */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-4 animate-spin text-[#8e8e8e]" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center py-10 text-xs text-[#8e8e8e]">No conversations yet.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupConversations(conversations)).map(([groupName, groupChats]) => (
                <div key={groupName} className="space-y-0.5">
                  <h3 className="px-3 pt-3 pb-1 text-[10.5px] font-bold text-gray-500 uppercase tracking-wider select-none">
                    {groupName}
                  </h3>
                  {groupChats.map((conv) => {
                    const isActive = activeConversation?._id === conv._id
                    const isEditing = editingChatId === conv._id

                    return (
                      <div
                        key={conv._id}
                        onClick={() => {
                          if (!isEditing) {
                            void handleSelectConversation(conv)
                            if (isMobile) setSidebarOpen(false)
                          }
                        }}
                        className={cn(
                          "group relative flex items-center justify-between rounded-xl px-3 py-2 text-sm cursor-pointer select-none transition-all",
                          isActive
                            ? "bg-emerald-500/10 text-white font-medium border-l-2 border-emerald-400 shadow-sm"
                            : "text-gray-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        {isEditing ? (
                          <form
                            onSubmit={(e) => void handleSaveRename(conv._id, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 w-full"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingChatId(null)
                              }}
                              className="w-full bg-[#161822] border border-emerald-500/50 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              type="submit"
                              className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                              title="Save title"
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingChatId(null)}
                              className="p-1 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              <X className="size-3.5" />
                            </button>
                          </form>
                        ) : (
                          <>
                            <span className="truncate pr-14 text-[13px]">{conv.title}</span>
                            <div className="absolute right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => handleStartRename(conv, e)}
                                className="text-gray-400 hover:text-emerald-400 transition-all p-1 rounded-md cursor-pointer"
                                title="Rename chat"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={(e) => void handleDeleteChat(conv, e)}
                                className="text-gray-400 hover:text-red-400 transition-all p-1 rounded-md cursor-pointer"
                                title="Delete chat"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-white/[0.08] p-2 space-y-0.5 bg-[#0b0c13]">
          {/* Email verification banner */}
          {userProfile && userProfile.isEmailVerified === false && (
            <div className="mx-0.5 mb-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-400">
                Verify your email
              </p>
              <p className="mt-0.5 text-[10.5px] text-gray-400 leading-tight">
                Some features stay locked until verified.
              </p>
              <button
                onClick={() => void handleResendVerification()}
                className="mt-1 text-[11px] text-amber-300 hover:underline cursor-pointer font-medium"
              >
                Resend verification link
              </button>
            </div>
          )}

          {/* Graph Explorer */}
          <button
            onClick={() => router.push("/dashboard/graph")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-xs font-medium cursor-pointer"
          >
            <Share2 className="size-4 shrink-0 text-emerald-400/80" />
            <span>Graph Explorer</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push("/dashboard/settings")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-xs font-medium cursor-pointer"
          >
            <Settings className="size-4 shrink-0 text-cyan-400/80" />
            <span>Settings</span>
          </button>

          {/* Developer Platform */}
          <button
            onClick={() => router.push("/dashboard/developer")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-xs font-medium cursor-pointer"
          >
            <Code className="size-4 shrink-0 text-indigo-400/80" />
            <span>Developer Platform</span>
          </button>

          {/* Analytics Console */}
          <button
            onClick={() => router.push("/dashboard/analytics")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-xs font-medium cursor-pointer"
          >
            <BarChart3 className="size-4 shrink-0 text-purple-400/80" />
            <span>Analytics Console</span>
          </button>

          {/* Document Library */}
          <button
            onClick={() => setDocModalOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-xs font-medium cursor-pointer"
          >
            <Database className="size-4 shrink-0 text-teal-400/80" />
            <span>Document Library</span>
          </button>

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left cursor-pointer select-none bg-transparent border-0 outline-none">
              <div className="size-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black font-bold text-xs shrink-0 shadow-md">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {userProfile?.name || "User"}
                </p>
                <p className="truncate text-[10.5px] text-gray-400">
                  {userProfile?.email || ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 bg-[#161822] border-white/10 text-white p-1 rounded-xl shadow-2xl z-50"
              side="top"
              align="start"
            >
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-xs text-red-400 hover:bg-white/5 hover:text-red-400 focus:bg-white/5 focus:text-red-400"
              >
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ================================================================
          MAIN CHAT AREA
          ================================================================ */}
      <main className="flex-1 flex flex-col h-full bg-[#090a10] relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/[0.03] rounded-full blur-[140px] pointer-events-none" />
        
        {/* Top Navbar Header */}
        <header className="h-14 flex items-center justify-between border-b border-white/[0.08] bg-[#0d0f16]/80 backdrop-blur-xl px-4 select-none shrink-0 z-10">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Open sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>
            )}

            {/* Model Selector Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors text-xs font-semibold text-gray-300 hover:text-white bg-transparent border border-white/10 cursor-pointer">
                <Sparkles className="size-3.5 text-emerald-400" />
                <span>{activeModel === "gemini-2.0-flash" ? "Gemini 2.0 Flash" : "Gemini 1.5 Flash"}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-[#161822] border-white/10 text-white p-1 rounded-xl shadow-2xl z-50">
                <DropdownMenuItem
                  onClick={() => setActiveModel("gemini-2.0-flash")}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg cursor-pointer text-xs hover:bg-white/5 focus:bg-white/5",
                    activeModel === "gemini-2.0-flash" && "bg-white/5 text-emerald-400 font-semibold"
                  )}
                >
                  <span className="font-semibold text-xs">Gemini 2.0 Flash</span>
                  <span className="text-[10px] text-gray-400 leading-tight mt-0.5">High speed general reasoning & coding</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActiveModel("gemini-1.5-flash")}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg cursor-pointer text-xs hover:bg-white/5 focus:bg-white/5",
                    activeModel === "gemini-1.5-flash" && "bg-white/5 text-emerald-400 font-semibold"
                  )}
                >
                  <span className="font-semibold text-xs">Gemini 1.5 Flash</span>
                  <span className="text-[10px] text-gray-400 leading-tight mt-0.5">Balanced speed & reasoning</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleExportChat}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-xs font-medium cursor-pointer"
                title="Export Chat as Markdown"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Export</span>
              </button>
            )}
          </div>
        </header>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-2">
            
            {/* Empty state */}
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center text-center pt-28 pb-8">
                <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/10">
                  <Sparkles className="size-6 text-emerald-400 animate-pulse" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                  What can I help with today?
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 max-w-md">
                  Upload document intelligence or ask anything grounded in your knowledge base.
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <MessageRow key={index} msg={msg} conversationId={activeConversation?._id} />
              ))}

              {/* Streaming message */}
              {isStreaming && (
                <MessageRow
                  msg={{ role: "assistant", content: streamingText, sources: streamingSources }}
                  isStreaming
                />
              )}

              {/* Thinking indicator */}
              {loading && !isStreaming && (
                <div className="py-3 px-2 my-2">
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <Sparkles className="size-4 text-emerald-400 animate-pulse" />
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>
        </div>

        {/* Input Composer */}
        <div className="pb-6 px-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Attachment preview */}
            {attachment && (
              <div className="mb-3 flex items-center justify-between gap-3 bg-[#141722] border border-white/10 px-4 py-2.5 rounded-2xl text-xs backdrop-blur-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="size-4 text-emerald-400 shrink-0" />
                  <span className="truncate font-medium text-white">{attachment.file.name}</span>
                  <span className="text-[10px] text-gray-400">({formatBytes(attachment.file.size)})</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {attachment.status === "uploading" || attachment.status === "indexing" ? (
                    <>
                      <span className="text-[10px] text-gray-400 animate-pulse">{attachment.progressMessage}</span>
                      <Loader2 className="size-3.5 animate-spin text-emerald-400" />
                    </>
                  ) : attachment.status === "ready" ? (
                    <span className="text-[10px] text-emerald-400 font-semibold">Ready</span>
                  ) : (
                    <span className="text-[10px] text-red-400">Failed</span>
                  )}
                  <button
                    onClick={() => setAttachment(null)}
                    disabled={loading}
                    className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Input Box */}
            <div className="relative rounded-2xl bg-[#141722]/90 backdrop-blur-xl border border-white/10 shadow-2xl focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/15 transition-all">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.docx,.xlsx,.pptx"
                className="hidden"
                onChange={handleFileAttach}
              />

              <Textarea
                value={input}
                disabled={loading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message NeuroStack AI..."
                rows={1}
                className="w-full min-h-[52px] max-h-[200px] resize-none border-0 bg-transparent py-4 pl-4 pr-24 text-[15px] text-white placeholder-gray-500 shadow-none focus-visible:ring-0 leading-6"
              />

              {/* Bottom action row */}
              <div className="flex items-center justify-between px-3 pb-3">
                {/* Attach Document button */}
                <button
                  type="button"
                  disabled={loading || attachment !== null}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Attach Document"
                >
                  <Paperclip className="size-4" />
                </button>

                {/* Send/Stop button */}
                {isStreaming || loading ? (
                  <button
                    onClick={handleStopGenerating}
                    className="size-8 rounded-full flex items-center justify-center bg-white text-black hover:bg-white/90 transition-all cursor-pointer"
                    title="Stop generating"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => void handleSend()}
                    disabled={loading || (!input.trim() && !attachment)}
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center transition-all",
                      input.trim() || attachment
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold shadow-lg shadow-emerald-500/25 cursor-pointer"
                        : "bg-white/10 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    <Send className="size-4 text-black" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-center text-[11px] text-gray-500 mt-3 select-none">
              NeuroStack AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </main>

      {/* Document Library Modal */}
      <ManageDocumentsModal open={docModalOpen} onClose={() => setDocModalOpen(false)} />
    </div>
  )
}

/* ============================================================
   MESSAGE ROW
   ============================================================ */

function MessageRow({
  msg,
  conversationId,
  isStreaming = false,
}: {
  msg: ChatMessage
  conversationId?: string
  isStreaming?: boolean
}) {
  const isAI = msg.role === "assistant"
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(msg.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  // USER MESSAGE: Clean right-aligned speech bubble (No logo, no name header)
  if (!isAI) {
    return (
      <div className="flex justify-end my-3.5 px-2">
        <div className="bg-[#1f2330] border border-white/10 text-[#ececec] px-5 py-3.5 rounded-3xl rounded-tr-md max-w-[85%] sm:max-w-[75%] shadow-md whitespace-pre-wrap text-[15px] leading-relaxed select-text">
          {msg.content}
        </div>
      </div>
    )
  }

  // AI ASSISTANT MESSAGE: Clean full-width response stream (No logo, no name header)
  return (
    <div className="group relative py-3 px-2 my-1">
      <div className="text-[15px] leading-7 text-[#ececec] select-text">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 className="mb-4 mt-6 text-xl font-bold text-white first:mt-0">{children}</h1>,
            h2: ({ children }) => <h2 className="mb-3 mt-5 text-lg font-bold text-white first:mt-0">{children}</h2>,
            h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold text-white first:mt-0">{children}</h3>,
            p: ({ children }) => <p className="my-2.5 leading-7 first:mt-0 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
            ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
            li: ({ children }) => <li className="leading-7">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
            blockquote: ({ children }) => (
              <blockquote className="my-4 border-l-2 border-emerald-500/50 pl-4 text-gray-400 italic bg-white/[0.02] py-1 rounded-r-lg">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto rounded-xl border border-white/10 shadow-lg">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-white/10 bg-white/10 px-4 py-2.5 text-left font-semibold text-white">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-white/10 px-4 py-2.5 align-top">{children}</td>
            ),
            code: ({ className, children }) => {
              const match = /language-(\w+)/.exec(className || "")
              const codeStr = String(children).replace(/\n$/, "")
              const isInline = !match

              if (isInline) {
                return (
                  <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-emerald-300">
                    {children}
                  </code>
                )
              }
              return <CodeBlock lang={match ? match[1] : "code"} code={codeStr} />
            },
          }}
        >
          {msg.content}
        </ReactMarkdown>

        {/* Streaming caret */}
        {isStreaming && (
          <span className="inline-block align-middle ml-1 w-[3px] h-[1.2em] bg-emerald-400 animate-pulse rounded-full" />
        )}
      </div>

      {/* Copy + Feedback actions */}
      {!isStreaming && (
        <div className="flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {msg._id && conversationId && (
            <FeedbackButtons
              messageId={msg._id}
              conversationId={conversationId}
              initialRating={msg.feedback?.rating}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   CODE BLOCK
   ============================================================ */

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-white/10 font-mono text-[13px]">
      <div className="bg-[#171717] border-b border-white/10 px-4 py-2.5 flex items-center justify-between">
        <span className="text-[11px] font-sans font-medium text-[#8e8e8e] uppercase tracking-wider">
          {lang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[#8e8e8e] hover:text-[#ececec] transition-colors text-[11px] font-sans"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-[#19c37d]" />
              <span className="text-[#19c37d]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <div className="bg-black/50 overflow-x-auto p-4">
        <pre className="text-[#ececec] leading-6">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}

/* ============================================================
   UTILITIES
   ============================================================ */

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}
