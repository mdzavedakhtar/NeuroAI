"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  Database,
  FileText,
  Loader2,
  LogOut,
  Menu,
  Paperclip,
  Plus,
  Send,
  Trash2,
  User,
  X,
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
} from "./chat.service"
import {
  uploadKnowledge,
  indexKnowledge,
  extractKnowledgeId,
} from "@/features/knowledge/knowledge.service"
import { logout } from "@/features/auth/auth.service"
import { getToken } from "@/services/api"
import { ManageDocumentsModal } from "./manage-documents-modal"
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

  const [activeModel, setActiveModel] = useState<string>("gemini-3.6-flash")
  const abortControllerRef = useRef<AbortController | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const [userProfile, setUserProfile] = useState<{ name?: string; email?: string } | null>(null)

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

    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are supported.")
      return
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("PDF file exceeds 25 MB limit.")
      return
    }

    setAttachment({
      file,
      knowledgeId: "",
      status: "uploading",
      progressMessage: "Uploading PDF...",
    })

    try {
      const uploadRes = await uploadKnowledge(file)
      const knowledgeId = extractKnowledgeId(uploadRes)
      if (!knowledgeId) throw new Error("Could not index document.")

      setAttachment({ file, knowledgeId, status: "indexing", progressMessage: "Indexing..." })
      await indexKnowledge(knowledgeId)
      setAttachment({ file, knowledgeId, status: "ready", progressMessage: "Ready" })
      toast.success(`${file.name} indexed successfully.`)
    } catch (err) {
      console.error(err)
      setAttachment({ file, knowledgeId: "", status: "error", progressMessage: "Failed" })
      toast.error(`Failed to process ${file.name}`)
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
        throw new Error("Failed to start message stream")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error("No response reader")

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
      const date = new Date(conv.updatedAt || conv.createdAt)
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

  const userInitial = userProfile?.name?.charAt(0).toUpperCase() || "U"

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121] text-[#ececec]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      
      {/* Mobile sidebar backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================================================================
          SIDEBAR
          ================================================================ */}
      <aside
        className={cn(
          "bg-[#171717] h-full flex flex-col shrink-0 transition-all duration-300 ease-in-out z-30 overflow-hidden",
          isMobile
            ? cn("fixed top-0 left-0 h-full", sidebarOpen ? "w-[280px] shadow-2xl" : "w-0")
            : cn(sidebarOpen ? "w-[260px]" : "w-0")
        )}
      >
        {/* Sidebar Top Actions */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 gap-1">
          {/* Toggle sidebar close */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-[#8e8e8e] hover:text-[#ececec] hover:bg-white/10 transition-colors"
            title="Close sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>

          {/* New Chat button */}
          <button
            onClick={handleNewChat}
            className="p-2 rounded-lg text-[#8e8e8e] hover:text-[#ececec] hover:bg-white/10 transition-colors ml-auto"
            title="New chat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>

        {/* Conversations History */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
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
                  <h3 className="px-3 pt-3 pb-1 text-[11px] font-semibold text-[#8e8e8e] uppercase tracking-wider select-none">
                    {groupName}
                  </h3>
                  {groupChats.map((conv) => {
                    const isActive = activeConversation?._id === conv._id
                    return (
                      <div
                        key={conv._id}
                        onClick={() => {
                          void handleSelectConversation(conv)
                          if (isMobile) setSidebarOpen(false)
                        }}
                        className={cn(
                          "group relative flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer select-none transition-colors",
                          isActive
                            ? "bg-white/10 text-[#ececec]"
                            : "text-[#8e8e8e] hover:bg-white/5 hover:text-[#ececec]"
                        )}
                      >
                        <span className="truncate pr-6 text-[13.5px]">{conv.title}</span>
                        <button
                          onClick={(e) => void handleDeleteChat(conv, e)}
                          className="absolute right-2 opacity-0 group-hover:opacity-100 text-[#8e8e8e] hover:text-red-400 transition-all p-0.5 rounded"
                          title="Delete chat"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-white/[0.08] p-2 space-y-0.5">
          {/* Document Library */}
          <button
            onClick={() => setDocModalOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#8e8e8e] hover:bg-white/5 hover:text-[#ececec] transition-colors text-[13.5px]"
          >
            <Database className="size-4 shrink-0" />
            <span>Document Library</span>
          </button>

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer select-none bg-transparent border-0 outline-none">
              <div className="size-8 rounded-full bg-[#19c37d] flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-[#ececec]">
                  {userProfile?.name || "User"}
                </p>
                <p className="truncate text-[11px] text-[#8e8e8e]">
                  {userProfile?.email || ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 bg-[#2f2f2f] border-white/10 text-[#ececec] p-1 rounded-xl shadow-2xl"
              side="top"
              align="start"
            >
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-[13.5px] text-red-400 hover:bg-white/5 hover:text-red-400 focus:bg-white/5 focus:text-red-400"
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
      <main className="flex-1 flex flex-col h-full bg-[#212121] relative overflow-hidden">
        
        {/* Top Navbar Header */}
        <header className="h-14 flex items-center justify-between border-b border-white/[0.08] bg-[#212121] px-4 select-none shrink-0">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-[#8e8e8e] hover:text-[#ececec] hover:bg-white/10 transition-colors cursor-pointer"
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
              <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors text-[14px] font-semibold text-[#8e8e8e] hover:text-[#ececec] bg-transparent border-0 outline-none cursor-pointer">
                <span>{activeModel === "gemini-3.6-flash" ? "Gemini 2.0 Flash" : "Gemini 1.5 Pro"}</span>
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52 bg-[#2f2f2f] border-white/10 text-[#ececec] p-1 rounded-xl shadow-2xl z-50">
                <DropdownMenuItem
                  onClick={() => setActiveModel("gemini-3.6-flash")}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg cursor-pointer text-[13px] hover:bg-white/5 focus:bg-white/5",
                    activeModel === "gemini-3.6-flash" && "bg-white/5 text-[#ececec]"
                  )}
                >
                  <span className="font-semibold text-[13px]">Gemini 2.0 Flash</span>
                  <span className="text-[10px] text-[#8e8e8e] leading-tight mt-0.5">High speed general reasoning & coding</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActiveModel("gemini-1.5-pro")}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg cursor-pointer text-[13px] hover:bg-white/5 focus:bg-white/5",
                    activeModel === "gemini-1.5-pro" && "bg-white/5 text-[#ececec]"
                  )}
                >
                  <span className="font-semibold text-[13px]">Gemini 1.5 Pro</span>
                  <span className="text-[10px] text-[#8e8e8e] leading-tight mt-0.5">Complex logic, coding and deep analysis</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleExportChat}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#8e8e8e] hover:text-[#ececec] hover:bg-white/10 transition-colors text-[13px] font-medium cursor-pointer"
                title="Export Chat as Markdown"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-1">
            
            {/* Empty state */}
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center text-center pt-32 pb-8">
                <h1 className="text-[28px] font-semibold text-[#ececec] mb-2">
                  What can I help with?
                </h1>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-0">
              {messages.map((msg, index) => (
                <MessageRow key={index} msg={msg} userInitial={userInitial} />
              ))}

              {/* Streaming message */}
              {isStreaming && (
                <MessageRow
                  msg={{ role: "assistant", content: streamingText, sources: streamingSources }}
                  isStreaming
                  userInitial={userInitial}
                />
              )}

              {/* Thinking indicator */}
              {loading && !isStreaming && (
                <div className="py-4 px-4">
                  <div className="max-w-3xl mx-auto flex gap-4 items-start">
                    <div className="size-8 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="16" height="16" viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-7.505-3.348 10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.504 3.347 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813z" fill="#000"/>
                      </svg>
                    </div>
                    <div className="pt-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-[#8e8e8e] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-[#8e8e8e] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-[#8e8e8e] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
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
              <div className="mb-3 flex items-center justify-between gap-3 bg-[#2f2f2f] border border-white/10 px-3.5 py-2.5 rounded-xl text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="size-4 text-[#19c37d] shrink-0" />
                  <span className="truncate font-medium text-[#ececec]">{attachment.file.name}</span>
                  <span className="text-[10px] text-[#8e8e8e]">({formatBytes(attachment.file.size)})</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {attachment.status === "uploading" || attachment.status === "indexing" ? (
                    <>
                      <span className="text-[10px] text-[#8e8e8e] animate-pulse">{attachment.progressMessage}</span>
                      <Loader2 className="size-3.5 animate-spin text-[#19c37d]" />
                    </>
                  ) : attachment.status === "ready" ? (
                    <span className="text-[10px] text-[#19c37d] font-semibold">Ready</span>
                  ) : (
                    <span className="text-[10px] text-red-400">Failed</span>
                  )}
                  <button
                    onClick={() => setAttachment(null)}
                    disabled={loading}
                    className="text-[#8e8e8e] hover:text-[#ececec] transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Input Box */}
            <div className="relative rounded-2xl bg-[#2f2f2f] shadow-lg">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf"
                className="hidden"
                onChange={handleFileAttach}
              />

              <Textarea
                value={input}
                disabled={loading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message NeuroStack AI"
                rows={1}
                className="w-full min-h-[52px] max-h-[200px] resize-none border-0 bg-transparent py-4 pl-4 pr-24 text-[15px] text-[#ececec] placeholder-[#8e8e8e] shadow-none focus-visible:ring-0 leading-6"
              />

              {/* Bottom action row */}
              <div className="flex items-center justify-between px-3 pb-3">
                {/* Attach PDF button */}
                <button
                  type="button"
                  disabled={loading || attachment !== null}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg text-[#8e8e8e] hover:text-[#ececec] hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Attach PDF"
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
                        ? "bg-white text-black hover:bg-white/90 cursor-pointer"
                        : "bg-[#676767] text-[#8e8e8e] cursor-not-allowed"
                    )}
                  >
                    <Send className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-center text-xs text-[#8e8e8e] mt-3 select-none">
              NeuroStack AI can make mistakes. Check important info.
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
  isStreaming = false,
  userInitial,
}: {
  msg: ChatMessage
  isStreaming?: boolean
  userInitial: string
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

  return (
    <div className="group py-4 px-4">
      <div className="max-w-3xl mx-auto flex gap-4 items-start">
        {/* Avatar */}
        {isAI ? (
          <div className="size-8 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5">
            {/* OpenAI-style logo silhouette */}
            <svg width="16" height="16" viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-7.505-3.348 10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.504 3.347 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813z" fill="#000"/>
            </svg>
          </div>
        ) : (
          <div className="size-8 rounded-full bg-[#19c37d] flex items-center justify-center text-white text-sm font-semibold shrink-0 mt-0.5">
            {userInitial}
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[13px] font-semibold text-[#ececec] mb-2 select-none">
            {isAI ? "NeuroStack AI" : "You"}
          </p>

          {isAI ? (
            <div className="text-[15px] leading-7 text-[#ececec] select-text">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="mb-4 mt-6 text-xl font-bold first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="mb-3 mt-5 text-lg font-bold first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h3>,
                  p: ({ children }) => <p className="my-2.5 leading-7 first:mt-0 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
                  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
                  li: ({ children }) => <li className="leading-7">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  blockquote: ({ children }) => (
                    <blockquote className="my-4 border-l-2 border-white/20 pl-4 text-[#8e8e8e] italic">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="my-4 overflow-x-auto rounded-lg border border-white/10">
                      <table className="w-full border-collapse text-sm">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-white/10 bg-white/5 px-3.5 py-2 text-left font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-white/10 px-3.5 py-2 align-top">{children}</td>
                  ),
                  code: ({ className, children }) => {
                    const match = /language-(\w+)/.exec(className || "")
                    const codeStr = String(children).replace(/\n$/, "")
                    const isInline = !match

                    if (isInline) {
                      return (
                        <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-[#ececec]">
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
                <span className="inline-block align-middle ml-0.5 w-[2px] h-[1.1em] bg-[#ececec] animate-pulse" />
              )}

              {/* RAG Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
                    Sources
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.map((src: any, sIdx: number) => (
                      <div
                        key={sIdx}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:border-white/20 transition-colors"
                      >
                        <FileText className="size-3.5 shrink-0 text-[#19c37d]" />
                        <span className="max-w-44 truncate text-[#ececec]">
                          {src.fileName ?? "Source Document"}
                        </span>
                        {typeof src.score === "number" && (
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[#8e8e8e]">
                            {(src.score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-[15px] leading-7 text-[#ececec] select-text">
              {msg.content}
            </div>
          )}

          {/* Copy Message Action (Visible on Hover) */}
          {!isStreaming && (
            <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-[11px] text-[#8e8e8e] hover:text-[#ececec] transition-colors bg-transparent border-0 outline-none cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="size-3 text-[#19c37d]" />
                    <span className="text-[#19c37d]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
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
