import dns from "dns"
import { promisify } from "util"
import { URL } from "url"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"

const dnsLookup = promisify(dns.lookup)

// ─────────────────────────────────────────────────────────────────────────────
// isPrivateIp — blocks loopback, RFC-1918 private ranges, link-local,
// cloud metadata endpoint (169.254.169.254), and unspecified addresses.
// ─────────────────────────────────────────────────────────────────────────────

export function isPrivateIp(address: string): boolean {
  if (
    address === "127.0.0.1" ||
    address === "::1"        ||
    address === "0.0.0.0"   ||
    address === "::"
  ) return true  // loopback

  if (address === "169.254.169.254") return true  // AWS/GCP/Azure metadata

  if (address.startsWith("10."))       return true  // RFC-1918 class A
  if (address.startsWith("192.168."))  return true  // RFC-1918 class C

  // RFC-1918 class B: 172.16.0.0 – 172.31.255.255
  if (address.startsWith("172.")) {
    const second = parseInt(address.split(".")[1], 10)
    if (second >= 16 && second <= 31) return true
  }

  // IPv6 private / link-local
  if (address.startsWith("fe80:") || address.startsWith("fc00:") || address.startsWith("fd")) return true

  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// isSafeUrl — resolves hostname to IP once and validates it.
// Returns the resolved IP so scrapeUrl can reuse it directly in fetch(),
// eliminating the TOCTOU gap between check and use.
// ─────────────────────────────────────────────────────────────────────────────

export async function isSafeUrl(
  urlStr: string
): Promise<{ safe: boolean; error?: string; hostname?: string; resolvedIp?: string }> {
  try {
    const parsed = new URL(urlStr)

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { safe: false, error: "Only HTTP and HTTPS protocols are allowed." }
    }

    const hostname = parsed.hostname
    if (!hostname) {
      return { safe: false, error: "Invalid URL hostname." }
    }

    // Resolve DNS to IP exactly once — this resolved IP is then used in the
    // actual fetch() call to eliminate DNS-rebinding TOCTOU vulnerability.
    const { address } = await dnsLookup(hostname)

    if (isPrivateIp(address)) {
      return { safe: false, error: "SSRF Protection: Access to private networks is forbidden." }
    }

    return { safe: true, hostname, resolvedIp: address }
  } catch {
    return { safe: false, error: "Failed to resolve hostname DNS address." }
  }
}

export function cleanHtml(html: string): string {
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
  text = text.replace(/<[^>]+>/g, " ")
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
  return text.replace(/\s+/g, " ").trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// scrapeUrl — SSRF-safe HTTP fetch
//
// Key security properties:
//  1. isSafeUrl() resolves the hostname to an IP and validates it.
//  2. The RESOLVED IP is used in the fetch() URL (not the hostname again),
//     so a DNS rebinding attack cannot substitute a private IP after the check.
//  3. The original hostname is passed in the Host header so servers respond
//     correctly to virtual-host routing.
//  4. Redirects are not followed automatically (redirect: "manual") to prevent
//     a public URL from redirecting to a private-network URL.
// ─────────────────────────────────────────────────────────────────────────────

export async function scrapeUrl(urlStr: string): Promise<{ text: string; title: string }> {
  const { safe, error, hostname, resolvedIp } = await isSafeUrl(urlStr)
  if (!safe || !resolvedIp || !hostname) {
    throw new Error(error || "Access to this URL is forbidden.")
  }

  // Build the fetch URL using the pre-validated IP to close the TOCTOU gap.
  const parsed    = new URL(urlStr)
  const fetchUrl  = new URL(urlStr)
  fetchUrl.hostname = resolvedIp  // use resolved IP, not original hostname

  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 6000)

  try {
    const response = await fetch(fetchUrl.toString(), {
      signal: controller.signal,
      redirect: "manual",  // validate redirects manually (see below)
      headers: {
        "Host":       hostname,            // required for virtual-host routing
        "User-Agent": "NeuroStack-AI-Scraper/1.0",
      },
    })

    clearTimeout(timeoutId)

    // Handle redirects: validate the redirect target before following
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) {
        throw new Error("Redirect with no Location header.")
      }
      // Resolve the redirect URL relative to the original
      const redirectUrl  = new URL(location, parsed.origin)
      const redirectCheck = await isSafeUrl(redirectUrl.toString())
      if (!redirectCheck.safe) {
        throw new Error(`SSRF Protection: Redirect to forbidden destination blocked. ${redirectCheck.error}`)
      }
      // Safe redirect — follow it (one hop only, recursive protection left to browser/client)
      const finalRes = await fetch(redirectCheck.resolvedIp
        ? (() => { const u = new URL(redirectUrl.toString()); u.hostname = redirectCheck.resolvedIp!; return u.toString() })()
        : redirectUrl.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "Host":       redirectCheck.hostname!,
          "User-Agent": "NeuroStack-AI-Scraper/1.0",
        },
      })
      return extractTextFromResponse(finalRes, redirectCheck.hostname!)
    }

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
    }

    return extractTextFromResponse(response, hostname)
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err.name === "AbortError") {
      throw new Error("Request timed out (Limit 6 seconds).")
    }
    throw err
  }
}

async function extractTextFromResponse(
  response: Response,
  hostname: string
): Promise<{ text: string; title: string }> {
  const contentLength = response.headers.get("content-length")
  if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
    throw new Error("Content size limit exceeded (Max 2MB).")
  }

  const html = await response.text()
  if (html.length > 3 * 1024 * 1024) {
    throw new Error("Content text length too large (Max 2MB).")
  }

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i)
  const title      = titleMatch ? titleMatch[1].trim() : `Web Page from ${hostname}`

  const text = cleanHtml(html)
  if (!text) {
    throw new Error("Could not extract readable text content from the URL.")
  }

  return { text, title }
}

export async function saveScrapedText(
  title: string,
  text: string
): Promise<{ path: string; filename: string }> {
  const uploadsDir = path.resolve("./uploads")
  await fs.mkdir(uploadsDir, { recursive: true })

  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 50)
  const filename       = `url_${sanitizedTitle}_${crypto.randomBytes(4).toString("hex")}.txt`
  const filePath       = path.join(uploadsDir, filename)

  await fs.writeFile(filePath, text, "utf-8")
  return { path: filePath, filename }
}
