"use client"

import {
  useRef,
  useState,
} from "react"

import {
  CheckCircle2,
  File,
  FileSpreadsheet,
  FileText,
  Loader2,
  Presentation,
  Trash2,
  UploadCloud,
} from "lucide-react"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  extractKnowledgeId,
  indexKnowledge,
  uploadKnowledge,
} from "@/features/knowledge/knowledge.service"

type UploadStatus =
  | "ready"
  | "uploading"
  | "indexing"
  | "complete"
  | "error"

type SelectedFile = {
  id: string
  file: File
  status: UploadStatus
  knowledgeId?: string
  message?: string
}

const MAX_FILE_SIZE =
  25 * 1024 * 1024

/*
 * The current NeuroStack backend PDF pipeline has already
 * been verified. Keep the frontend restricted to PDF until
 * parsers for the other formats are connected server-side.
 */
const acceptedExtensions = ["pdf"]

export function KnowledgeUpload() {
  const inputRef =
    useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<
    SelectedFile[]
  >([])

  const [dragging, setDragging] =
    useState(false)

  const [processing, setProcessing] =
    useState(false)

  function addFiles(
    incomingFiles: File[]
  ) {
    const validFiles: SelectedFile[] = []

    incomingFiles.forEach((file) => {
      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() ?? ""

      if (
        !acceptedExtensions.includes(
          extension
        )
      ) {
        toast.error(
          `${file.name}: currently only PDF upload is enabled.`
        )

        return
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(
          `${file.name} is larger than 25 MB.`
        )

        return
      }

      const alreadyExists =
        files.some(
          (existing) =>
            existing.file.name ===
              file.name &&
            existing.file.size ===
              file.size
        )

      if (alreadyExists) {
        toast.error(
          `${file.name} is already selected.`
        )

        return
      }

      validFiles.push({
        id: crypto.randomUUID(),
        file,
        status: "ready",
      })
    })

    if (validFiles.length > 0) {
      setFiles((current) => [
        ...current,
        ...validFiles,
      ])

      toast.success(
        `${validFiles.length} PDF${
          validFiles.length > 1
            ? "s"
            : ""
        } added.`
      )
    }
  }

  function updateFile(
    id: string,
    changes: Partial<SelectedFile>
  ) {
    setFiles((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...changes,
            }
          : item
      )
    )
  }

  function handleInputChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selected = Array.from(
      event.target.files ?? []
    )

    addFiles(selected)

    event.target.value = ""
  }

  function handleDrop(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault()

    setDragging(false)

    addFiles(
      Array.from(
        event.dataTransfer.files
      )
    )
  }

  function removeFile(id: string) {
    if (processing) {
      return
    }

    setFiles((current) =>
      current.filter(
        (item) => item.id !== id
      )
    )
  }

  function clearFiles() {
    if (processing) {
      return
    }

    setFiles([])
  }

  async function processSingleFile(
    item: SelectedFile
  ) {
    try {
      updateFile(item.id, {
        status: "uploading",
        message: "Uploading...",
      })

      const uploaded =
        await uploadKnowledge(
          item.file
        )

      const knowledgeId =
        extractKnowledgeId(uploaded)

      if (!knowledgeId) {
        throw new Error(
          "Upload succeeded but knowledge ID was not returned."
        )
      }

      updateFile(item.id, {
        status: "indexing",
        knowledgeId,
        message:
          "Creating embeddings...",
      })

      const indexed =
        await indexKnowledge(
          knowledgeId
        )

      updateFile(item.id, {
        status: "complete",
        message:
          indexed.message ??
          `${
            indexed.indexed ??
            indexed.count ??
            0
          } chunks indexed`,
      })

      return true
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Processing failed"

      updateFile(item.id, {
        status: "error",
        message,
      })

      toast.error(
        `${item.file.name}: ${message}`
      )

      return false
    }
  }

  async function startUpload() {
    const pendingFiles =
      files.filter(
        (item) =>
          item.status === "ready" ||
          item.status === "error"
      )

    if (pendingFiles.length === 0) {
      toast.error(
        "No files waiting for processing."
      )

      return
    }

    setProcessing(true)

    let successCount = 0

    /*
     * Sequential processing keeps the first implementation
     * predictable and avoids sending several large PDF jobs
     * to the backend simultaneously.
     */
    for (const item of pendingFiles) {
      const success =
        await processSingleFile(item)

      if (success) {
        successCount++
      }
    }

    setProcessing(false)

    if (
      successCount ===
      pendingFiles.length
    ) {
      toast.success(
        `${successCount} document${
          successCount > 1 ? "s" : ""
        } uploaded and indexed successfully.`
      )
    } else if (successCount > 0) {
      toast.success(
        `${successCount} document${
          successCount > 1 ? "s" : ""
        } processed successfully.`
      )
    }
  }

  return (
    <section className="rounded-xl border bg-card/40">
      <div className="border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UploadCloud className="size-4" />
          </div>

          <div>
            <h2 className="font-semibold">
              Upload Knowledge
            </h2>

            <p className="mt-0.5 text-xs text-muted-foreground">
              Upload PDFs, extract their
              content and index them into
              NeuroStack AI.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf"
          onChange={
            handleInputChange
          }
          className="hidden"
        />

        <div
          onDragEnter={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setDragging(false)
          }}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center transition",
            dragging
              ? "border-primary bg-primary/5"
              : "bg-background/40 hover:bg-muted/20"
          )}
        >
          <div className="flex size-12 items-center justify-center rounded-xl border bg-primary/10 text-primary">
            <UploadCloud className="size-5" />
          </div>

          <h3 className="mt-4 text-sm font-semibold">
            Drop your PDF here
          </h3>

          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            PDF files up to 25 MB.
            NeuroStack will extract,
            chunk and index the document
            for AI search.
          </p>

          <Button
            type="button"
            className="mt-4"
            disabled={processing}
            onClick={() =>
              inputRef.current?.click()
            }
          >
            Select PDFs
          </Button>
        </div>

        {files.length > 0 && (
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  Documents
                </h3>

                <p className="text-xs text-muted-foreground">
                  {files.length} selected
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={processing}
                onClick={clearFiles}
              >
                Clear all
              </Button>
            </div>

            <div className="space-y-2">
              {files.map((item) => (
                <FileRow
                  key={item.id}
                  item={item}
                  processing={
                    processing
                  }
                  onRemove={() =>
                    removeFile(
                      item.id
                    )
                  }
                />
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                disabled={processing}
                onClick={
                  startUpload
                }
              >
                {processing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-4" />
                    Upload & Index
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function FileRow({
  item,
  processing,
  onRemove,
}: {
  item: SelectedFile
  processing: boolean
  onRemove: () => void
}) {
  const extension =
    item.file.name
      .split(".")
      .pop()
      ?.toLowerCase() ?? ""

  const Icon =
    getFileIcon(extension)

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background/50 p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {item.file.name}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {formatFileSize(
              item.file.size
            )}
          </span>

          <span>•</span>

          <span className="uppercase">
            {extension}
          </span>

          {item.message && (
            <>
              <span>•</span>

              <span
                className={cn(
                  item.status ===
                    "error" &&
                    "text-destructive",
                  item.status ===
                    "complete" &&
                    "text-emerald-500"
                )}
              >
                {item.message}
              </span>
            </>
          )}
        </div>
      </div>

      <StatusIcon
        status={item.status}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={processing}
        aria-label={`Remove ${item.file.name}`}
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

function StatusIcon({
  status,
}: {
  status: UploadStatus
}) {
  if (
    status === "uploading" ||
    status === "indexing"
  ) {
    return (
      <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
    )
  }

  if (status === "complete") {
    return (
      <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
    )
  }

  return null
}

function getFileIcon(
  extension: string
) {
  if (extension === "pdf") {
    return FileText
  }

  if (
    extension === "xls" ||
    extension === "xlsx"
  ) {
    return FileSpreadsheet
  }

  if (
    extension === "ppt" ||
    extension === "pptx"
  ) {
    return Presentation
  }

  return File
}

function formatFileSize(
  bytes: number
) {
  if (bytes === 0) {
    return "0 B"
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ]

  const index = Math.floor(
    Math.log(bytes) /
      Math.log(1024)
  )

  const value =
    bytes /
    Math.pow(1024, index)

  return `${value.toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`
}
