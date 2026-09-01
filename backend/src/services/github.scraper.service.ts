import { URL } from "url"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import pLimit from "p-limit"

export interface IRepoParams {
  owner: string
  repo: string
}

export function parseGithubUrl(urlStr: string): IRepoParams {
  try {
    const parsed = new URL(urlStr)
    if (parsed.hostname !== "github.com") {
      throw new Error("Only GitHub URLs are supported.")
    }
    const parts = parsed.pathname.split("/").filter(Boolean)
    if (parts.length < 2) {
      throw new Error("Invalid GitHub repository URL. Must be github.com/owner/repo.")
    }
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") }
  } catch (err: any) {
    throw new Error(err.message || "Invalid repository URL format.")
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exclusion lists — keep secrets and binaries out of the knowledge bundle
// ─────────────────────────────────────────────────────────────────────────────

const EXCLUDED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "vendor",
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bin", "obj",
])

const EXCLUDED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip",
  ".tar.gz", ".exe", ".dll", ".mp4", ".mov", ".mp3", ".wav",
])

const EXCLUDED_FILES = new Set([
  ".env", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "id_rsa", "id_dsa", "credentials.json", "client_secret.json",
])

export function isFileAllowed(filePath: string): boolean {
  const parts = filePath.split("/")
  const fileName = parts[parts.length - 1]
  const ext = path.extname(fileName).toLowerCase()

  if (parts.some((p) => EXCLUDED_DIRS.has(p))) return false
  if (EXCLUDED_EXTENSIONS.has(ext)) return false
  if (EXCLUDED_FILES.has(fileName)) return false

  // Block any file that looks like it holds secrets
  if (
    fileName.includes("key") ||
    fileName.includes("secret") ||
    fileName.includes("token") ||
    ext === ".pem"
  ) {
    return false
  }

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch a single GitHub blob with exponential-backoff retry on 429/403/5xx.
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries = 3
): Promise<Response> {
  let lastErr: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { headers })

    if (res.status === 429 || res.status === 403) {
      // Rate-limited — back off before retrying
      const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
      console.warn(`[GITHUB] Rate-limited on ${url}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise((r) => setTimeout(r, delay))
      lastErr = new Error(`GitHub API rate limited (${res.status})`)
      continue
    }

    if (res.status >= 500 && attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 500
      console.warn(`[GITHUB] Server error ${res.status} on ${url}. Retrying in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
      lastErr = new Error(`GitHub API server error (${res.status})`)
      continue
    }

    return res
  }

  throw lastErr ?? new Error(`Failed to fetch ${url} after ${maxRetries} retries`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main repository fetch — parallel file downloads with bounded concurrency
// ─────────────────────────────────────────────────────────────────────────────

// Max parallel GitHub API requests — stays well within both primary and
// secondary GitHub rate limits (5000 req/hr authenticated).
const FETCH_CONCURRENCY = 5

export async function fetchGithubRepoText(
  owner: string,
  repo: string,
  token?: string
): Promise<string> {
  const headers: Record<string, string> = {
    "User-Agent": "NeuroStack-AI-Ingester/1.0",
    Accept: "application/vnd.github.v3+json",
  }
  if (token) {
    headers["Authorization"] = `token ${token}`
  }

  // Fetch the repo tree
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`
  let treeRes = await fetchWithRetry(treeUrl, headers)

  // Fallback to master branch
  if (treeRes.status === 404) {
    const fallbackUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`
    treeRes = await fetchWithRetry(fallbackUrl, headers)
  }

  if (!treeRes.ok) {
    throw new Error(
      `Failed to access GitHub repository API (${treeRes.status}: ${treeRes.statusText}). ` +
      `Check credentials or repo visibility.`
    )
  }

  const data = await treeRes.json()
  const allFiles = (data.tree || []) as Array<{ type: string; path: string; size: number }>

  // Filter to allowed blobs under 150KB each
  const allowedFiles = allFiles.filter(
    (f) => f.type === "blob" && isFileAllowed(f.path) && f.size <= 150 * 1024
  )

  const MAX_BUNDLE_BYTES = 2 * 1024 * 1024
  let bundleText = `=== GITHUB REPOSITORY BUNDLE: ${owner}/${repo} ===\n\n`
  let totalBytes = 0

  const limit = pLimit(FETCH_CONCURRENCY)

  // Fetch all allowed blobs in parallel (bounded)
  const fileChunks = await Promise.all(
    allowedFiles.map((file) =>
      limit(async () => {
        if (totalBytes >= MAX_BUNDLE_BYTES) {
          // Already hit bundle cap — skip but don't throw
          return null
        }

        try {
          const blobUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`
          const blobRes = await fetchWithRetry(blobUrl, headers)

          if (!blobRes.ok) {
            console.warn(`[GITHUB] Skipped ${file.path}: HTTP ${blobRes.status}`)
            return null
          }

          const blobData = await blobRes.json()
          if (!blobData.content) return null

          const decoded = Buffer.from(blobData.content, "base64").toString("utf-8")
          totalBytes += file.size
          return `\n--- FILE: ${file.path} ---\n${decoded}\n`
        } catch (err: any) {
          console.warn(`[GITHUB] Skipped ${file.path}: ${err.message}`)
          return null
        }
      })
    )
  )

  // Assemble bundle, respecting size cap
  let accumulated = 0
  for (const chunk of fileChunks) {
    if (!chunk) continue
    const chunkSize = Buffer.byteLength(chunk, "utf-8")
    if (accumulated + chunkSize > MAX_BUNDLE_BYTES) {
      console.warn("[GITHUB] Skipped remaining files: reached 2MB size cap.")
      break
    }
    bundleText += chunk
    accumulated += chunkSize
  }

  return bundleText
}

export async function saveGithubBundle(owner: string, repo: string, text: string) {
  const uploadsDir = path.resolve("./uploads")
  await fs.mkdir(uploadsDir, { recursive: true })

  const filename = `github_${owner}_${repo}_${crypto.randomBytes(4).toString("hex")}.txt`
  const filePath = path.join(uploadsDir, filename)

  await fs.writeFile(filePath, text, "utf-8")
  return { path: filePath, filename }
}
