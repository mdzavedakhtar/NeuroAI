"use client"

import { useEffect, useRef, useState } from "react"
import {
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  X
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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

  useEffect(() => {
    if (open) {
      void loadSources()
    }
  }, [open])

  async function loadSources() {
    try {
      setLoadingSources(true)
      const res = await getKnowledgeSources()
      if (res.success) {
        setSources(res.sources)
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to load documents list.")
    } finally {
      setLoadingSources(false)
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
    const selected = Array.from(e.target.files ?? [])
    addFiles(selected)
    e.target.value = ""
  }

  function addFiles(incoming: File[]) {
    const valid: SelectedFile[] = []
    incoming.forEach((file) => {
      if (file.type !== "application/pdf") {
        toast.error(`${file.name}: only PDFs are supported.`)
        return
      }
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name}: file exceeds 25MB limit.`)
        return
      }
      valid.push({
        id: crypto.randomUUID(),
        file,
        status: "ready",
      })
    })

    if (valid.length > 0) {
      setUploadingFiles((curr) => [...curr, ...valid])
    }
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

        if (!knowledgeId) {
          throw new Error("Missing knowledge ID from upload response.")
        }

        updateFileStatus(item.id, "indexing", "Indexing content...")
        await indexKnowledge(knowledgeId)
        updateFileStatus(item.id, "complete", "Indexed successfully")

        // Wait a tiny bit then reload the source list
        await loadSources()
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Indexing failed"
        updateFileStatus(item.id, "error", msg)
        toast.error(`Failed to process ${item.file.name}: ${msg}`)
      }
    }
    setProcessing(false)
  }

  function updateFileStatus(
    id: string,
    status: SelectedFile["status"],
    message?: string
  ) {
    setUploadingFiles((curr) =>
      curr.map((f) => (f.id === id ? { ...f, status, message } : f))
    )
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()} >
      <DialogContent className="sm:max-w-2xl border-white/10 text-[#ececec] p-0 overflow-hidden" style={{ background: '#2f2f2f', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <DialogHeader className="p-5 pb-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-[16px] font-semibold text-[#ececec]">Document Library</DialogTitle>
            <DialogDescription className="text-[#8e8e8e] text-[13px] mt-1">
              Upload PDF files to query them across your conversations.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* File Drag and Drop */}
          <div
            onDragEnter={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setDragging(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              addFiles(Array.from(e.dataTransfer.files))
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition",
              dragging
                ? "border-white/40 bg-white/5"
                : "border-white/10 bg-[#212121] hover:bg-white/5"
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            <UploadCloud className="size-8 text-[#8e8e8e] mb-2" />
            <p className="text-[13px] font-medium text-[#ececec]">Click to browse or drag &amp; drop PDFs</p>
            <p className="text-[12px] text-[#8e8e8e] mt-1">PDF documents up to 25 MB</p>
          </div>

          {/* Queued uploads list */}
          {uploadingFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px] font-semibold text-[#8e8e8e] px-1">
                <span>Selected Files</span>
                <button
                  onClick={() => setUploadingFiles([])}
                  disabled={processing}
                  className="hover:text-[#ececec] transition-colors"
                >
                  Clear list
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {uploadingFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-[#212121] border border-white/10 p-2.5 rounded-xl text-[12px]"
                  >
                    <FileText className="size-4 text-[#ececec] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[#ececec]">{item.file.name}</p>
                      <p className="text-[#8e8e8e] text-[11px] mt-0.5">
                        {formatBytes(item.file.size)}
                        {item.message && ` • ${item.message}`}
                      </p>
                    </div>
                    {item.status === "uploading" || item.status === "indexing" ? (
                      <Loader2 className="size-3.5 animate-spin text-[#ececec]" />
                    ) : item.status === "complete" ? (
                      <CheckCircle2 className="size-3.5 text-[#19c37d]" />
                    ) : (
                      <button
                        onClick={() =>
                          setUploadingFiles((curr) => curr.filter((f) => f.id !== item.id))
                        }
                        disabled={processing}
                        className="text-[#8e8e8e] hover:text-[#ececec] transition-colors"
                      >
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
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Upload and Index"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Current Documents list */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-semibold text-[#8e8e8e] px-1">Indexed Documents</h3>
            {loadingSources ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-[#8e8e8e]" />
              </div>
            ) : sources.length === 0 ? (
              <div className="text-center py-8 border border-white/10 rounded-xl bg-[#212121] text-[#8e8e8e] text-[13px]">
                No indexed files in library yet.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {sources.map((source) => (
                  <div
                    key={source._id}
                    className="flex items-center justify-between gap-4 p-3 rounded-xl border border-white/10 bg-[#212121] hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                        <FileText className="size-4 text-[#ececec]" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[#ececec]">
                          {source.originalName}
                        </p>
                        <p className="text-[11px] text-[#8e8e8e] mt-0.5">
                          {source.chunks} chunks • {formatBytes(source.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => void handleDelete(source._id)}
                      className="text-[#8e8e8e] hover:text-red-400 transition-colors p-1 rounded"
                      title="Delete document"
                    >
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
