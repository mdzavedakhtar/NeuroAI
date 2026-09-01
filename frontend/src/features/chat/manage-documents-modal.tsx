"use client"

import { useEffect, useRef, useState } from "react"
import {
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  X,
  Globe,
  GitBranch,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getKnowledgeSources,
  deleteKnowledgeSource,
  uploadKnowledge,
  indexKnowledge,
  extractKnowledgeId,
} from "@/features/knowledge/knowledge.service"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/services/api"

interface ManageDocumentsModalProps {
  open: boolean
  onClose: () => void
}

type SelectedFile = {
  id: string
  file: File
  status: "ready" | "uploading" | "indexing" | "complete" | "error"
  message?: string
}

export function ManageDocumentsModal({
  open,
  onClose,
}: ManageDocumentsModalProps) {
  const [sources, setSources] = useState<any[]>([])
  const [loadingSources, setLoadingSources] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<SelectedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<"file" | "url" | "GitBranch">("file")
  const [scrapeUrlInput, setScrapeUrlInput] = useState("")
  const [scrapeGitBranchUrl, setScrapeGitBranchUrl] = useState("")
  const [GitBranchToken, setGitBranchToken] = useState("")
  const [scrapingUrl, setScrapingUrl] = useState(false)
  const [scrapingGitBranch, setScrapingGitBranch] = useState(false)

  useEffect(() => {
    if (open) void loadSources()
  }, [open])

  async function loadSources() {
    try {
      setLoadingSources(true)
      const res = await getKnowledgeSources()
      if (res.success) setSources(res.sources)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load documents list.")
    } finally {
      setLoadingSources(false)
    }
  }

  async function handleUrlScrape(e: React.FormEvent) {
    e.preventDefault()
    const targetUrl = scrapeUrlInput.trim()
    if (!targetUrl) return
    try {
      setScrapingUrl(true)
      const res = await apiFetch<{ success: boolean; message: string }>("/knowledge/url", {
        method: "POST",
        body: JSON.stringify({ url: targetUrl }),
      })
      if (res.success) {
        toast.success("URL content scraped and queued for indexing.")
        setScrapeUrlInput("")
        void loadSources()
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to scrape URL.")
    } finally {
      setScrapingUrl(false)
    }
  }

  async function handleGitBranchScrape(e: React.FormEvent) {
    e.preventDefault()
    const targetRepo = scrapeGitBranchUrl.trim()
    if (!targetRepo) return
    try {
      setScrapingGitBranch(true)
      const res = await apiFetch<{ success: boolean; message: string }>("/knowledge/GitBranch", {
        method: "POST",
        body: JSON.stringify({ repoUrl: targetRepo, token: GitBranchToken.trim() || undefined }),
      })
      if (res.success) {
        toast.success("GitBranch repository queued for indexing.")
        setScrapeGitBranchUrl("")
        setGitBranchToken("")
        void loadSources()
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to ingest GitBranch repository.")
    } finally {
      setScrapingGitBranch(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await deleteKnowledgeSource(id)
      if (res.success) {
        toast.success("Document deleted.")
        setSources((curr) => curr.filter((s) => s._id !== id))
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete document.")
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ""
  }

  function addFiles(incoming: File[]) {
    const valid: SelectedFile[] = []
    const allowedMimes = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ])
    const allowedExts = new Set([".pdf", ".docx", ".xlsx", ".pptx"])
    incoming.forEach((file) => {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
      if (!allowedMimes.has(file.type) && !allowedExts.has(ext)) {
        toast.error(`${file.name}: unsupported format. Only PDF, DOCX, XLSX, and PPTX.`)
        return
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name}: exceeds 50 MB limit.`)
        return
      }
      valid.push({ id: crypto.randomUUID(), file, status: "ready" })
    })
    if (valid.length > 0) setUploadingFiles((curr) => [...curr, ...valid])
  }

  async function handleUploadAndIndex() {
    const pending = uploadingFiles.filter((f) => f.status === "ready")
    if (pending.length === 0) return
    setProcessing(true)
    for (const item of pending) {
      try {
        updateFileStatus(item.id, "uploading", "Uploading...")
        const uploaded = await uploadKnowledge(item.file)
        const knowledgeId = extractKnowledgeId(uploaded)
        if (!knowledgeId) throw new Error("Missing knowledge ID from upload response.")
        updateFileStatus(item.id, "indexing", "Indexing content...")
        await indexKnowledge(knowledgeId)
        updateFileStatus(item.id, "complete", "Indexed successfully")
        await loadSources()
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Indexing failed"
        updateFileStatus(item.id, "error", msg)
        toast.error(`Failed to process ${item.file.name}: ${msg}`)
      }
    }
    setProcessing(false)
  }

  function updateFileStatus(id: string, status: SelectedFile["status"], message?: string) {
    setUploadingFiles((curr) => curr.map((f) => (f.id === id ? { ...f, status, message } : f)))
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        className="sm:max-w-2xl border-white/10 text-[#ececec] p-0 overflow-hidden"
        style={{ background: "#2f2f2f", fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-[16px] font-semibold text-[#ececec]">Document Library</DialogTitle>
          <DialogDescription className="text-[#8e8e8e] text-[13px] mt-1">
            Upload files, scrape web pages, or index GitBranch repositories to power your AI knowledge base.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Tab Selector */}
          <div className="flex border-b border-white/[0.08] text-[12.5px] font-medium text-[#8e8e8e]">
            {(
              [
                { key: "file", label: "Upload File", Icon: UploadCloud },
                { key: "url", label: "Web URL", Icon: Globe },
                { key: "GitBranch", label: "GitBranch Repo", Icon: GitBranch },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 transition-all cursor-pointer select-none",
                  activeTab === key
                    ? "border-[#19c37d] text-[#ececec] font-semibold"
                    : "border-transparent hover:text-[#ececec]"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab: File Upload */}
          {activeTab === "file" && (
            <>
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  addFiles(Array.from(e.dataTransfer.files))
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                  dragging
                    ? "border-white/40 bg-white/5 scale-[1.01]"
                    : "border-white/10 bg-[#212121] hover:bg-white/5 hover:border-white/20"
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".pdf,.docx,.xlsx,.pptx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="flex size-12 items-center justify-center rounded-xl bg-white/5 mb-3">
                  <UploadCloud className="size-6 text-[#8e8e8e]" />
                </div>
                <p className="text-[13px] font-medium text-[#ececec]">Click to browse or drag &amp; drop files</p>
                <p className="text-[12px] text-[#8e8e8e] mt-1">PDF, DOCX, XLSX, or PPTX · up to 50 MB</p>
              </div>

              {uploadingFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[12px] font-semibold text-[#8e8e8e] px-1">
                    <span>Selected Files</span>
                    <button onClick={() => setUploadingFiles([])} disabled={processing} className="hover:text-[#ececec] transition-colors cursor-pointer">
                      Clear list
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {uploadingFiles.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 bg-[#212121] border border-white/10 p-2.5 rounded-xl text-[12px]">
                        <FileText className="size-4 text-[#ececec] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-[#ececec]">{item.file.name}</p>
                          <p className="text-[#8e8e8e] text-[11px] mt-0.5">
                            {formatBytes(item.file.size)}{item.message && ` • ${item.message}`}
                          </p>
                        </div>
                        {item.status === "uploading" || item.status === "indexing" ? (
                          <Loader2 className="size-3.5 animate-spin text-[#ececec]" />
                        ) : item.status === "complete" ? (
                          <CheckCircle2 className="size-3.5 text-[#19c37d]" />
                        ) : (
                          <button onClick={() => setUploadingFiles((curr) => curr.filter((f) => f.id !== item.id))} disabled={processing} className="text-[#8e8e8e] hover:text-[#ececec] transition-colors cursor-pointer">
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleUploadAndIndex}
                      disabled={processing || !uploadingFiles.some((f) => f.status === "ready")}
                      className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {processing ? (<><Loader2 className="size-3.5 animate-spin" />Processing...</>) : "Upload and Index"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tab: Web URL */}
          {activeTab === "url" && (
            <form onSubmit={handleUrlScrape} className="space-y-4 bg-[#212121] border border-white/10 p-5 rounded-xl">
              <div>
                <label className="block text-[11px] font-semibold text-[#8e8e8e] uppercase tracking-wider mb-2">
                  Public Web Page URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/article"
                  value={scrapeUrlInput}
                  onChange={(e) => setScrapeUrlInput(e.target.value)}
                  disabled={scrapingUrl}
                  className="w-full rounded-xl bg-[#292929] border border-white/10 px-3.5 py-2.5 text-[13px] text-[#ececec] placeholder-[#5e5e5e] outline-none focus:border-white/30 transition-all"
                />
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[11px] text-[#8e8e8e] leading-relaxed">
                  Fetches readable text from public pages. Protected against SSRF, private networks, and metadata endpoints.
                </span>
                <button
                  type="submit"
                  disabled={scrapingUrl || !scrapeUrlInput.trim()}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl bg-white text-black px-4 py-2 text-[12.5px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {scrapingUrl ? (<><Loader2 className="size-3.5 animate-spin" />Scraping...</>) : (<><Globe className="size-3.5" />Scrape &amp; Index</>)}
                </button>
              </div>
            </form>
          )}

          {/* Tab: GitBranch Repository */}
          {activeTab === "GitBranch" && (
            <form onSubmit={handleGitBranchScrape} className="space-y-4 bg-[#212121] border border-white/10 p-5 rounded-xl">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#8e8e8e] uppercase tracking-wider mb-2">
                    Repository URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://GitBranch.com/owner/repo"
                    value={scrapeGitBranchUrl}
                    onChange={(e) => setScrapeGitBranchUrl(e.target.value)}
                    disabled={scrapingGitBranch}
                    className="w-full rounded-xl bg-[#292929] border border-white/10 px-3.5 py-2.5 text-[13px] text-[#ececec] placeholder-[#5e5e5e] outline-none focus:border-white/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#8e8e8e] uppercase tracking-wider mb-2">
                    Access Token <span className="normal-case font-normal text-[#5e5e5e]">(optional)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="ghp_ token for private repos"
                    value={GitBranchToken}
                    onChange={(e) => setGitBranchToken(e.target.value)}
                    disabled={scrapingGitBranch}
                    className="w-full rounded-xl bg-[#292929] border border-white/10 px-3.5 py-2.5 text-[13px] text-[#ececec] placeholder-[#5e5e5e] outline-none focus:border-white/30 transition-all"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[11px] text-[#8e8e8e] leading-relaxed">
                  Indexes source files, excluding binaries, secrets, lockfiles, and node_modules.
                </span>
                <button
                  type="submit"
                  disabled={scrapingGitBranch || !scrapeGitBranchUrl.trim()}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl bg-white text-black px-4 py-2 text-[12.5px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {scrapingGitBranch ? (<><Loader2 className="size-3.5 animate-spin" />Bundling...</>) : (<><GitBranch className="size-3.5" />Index Repository</>)}
                </button>
              </div>
            </form>
          )}

          {/* Indexed Documents List */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-semibold text-[#8e8e8e] px-1">Indexed Documents</h3>
            {loadingSources ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-[#8e8e8e]" />
              </div>
            ) : sources.length === 0 ? (
              <div className="text-center py-8 border border-white/10 rounded-xl bg-[#212121] text-[#8e8e8e] text-[13px]">
                No indexed documents in library yet.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {sources.map((source) => (
                  <div key={source._id} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-white/10 bg-[#212121] hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                        {source.originalName?.startsWith("GitBranch-") ? (
                          <GitBranch className="size-4 text-[#ececec]" />
                        ) : source.mimeType === "text/plain" ? (
                          <Globe className="size-4 text-[#ececec]" />
                        ) : (
                          <FileText className="size-4 text-[#ececec]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[#ececec]">{source.originalName}</p>
                        <p className="text-[11px] text-[#8e8e8e] mt-0.5">
                          {source.chunks} chunks · {formatBytes(source.size)}
                          {source.status !== "ready" && (
                            <span className="ml-1.5 inline-flex items-center gap-1 text-amber-400">
                              <Loader2 className="size-2.5 animate-spin" />
                              {source.status}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => void handleDelete(source._id)} className="text-[#8e8e8e] hover:text-red-400 transition-colors p-1 rounded cursor-pointer" title="Delete document">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

