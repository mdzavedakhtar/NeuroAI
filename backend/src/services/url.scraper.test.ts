import { describe, expect, it, vi } from "vitest"
import { isPrivateIp, isSafeUrl } from "./url.scraper.service"

describe("URL Scraper SSRF protection checks", () => {
  it("isPrivateIp correctly identifies private and loopback subnets", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true)
    expect(isPrivateIp("10.0.0.1")).toBe(true)
    expect(isPrivateIp("192.168.1.100")).toBe(true)
    expect(isPrivateIp("172.16.0.5")).toBe(true)
    expect(isPrivateIp("172.31.255.255")).toBe(true)
    expect(isPrivateIp("169.254.169.254")).toBe(true)
    expect(isPrivateIp("::1")).toBe(true)
    expect(isPrivateIp("8.8.8.8")).toBe(false)
    expect(isPrivateIp("142.250.190.46")).toBe(false)
  })

  it("isSafeUrl permits safe public HTTP/HTTPS URLs", async () => {
    const check = await isSafeUrl("https://www.google.com")
    expect(check.safe).toBe(true)
    expect(check.hostname).toBe("www.google.com")
    expect(check.resolvedIp).toBeDefined()
    expect(isPrivateIp(check.resolvedIp!)).toBe(false)
  })

  it("isSafeUrl rejects private network URLs", async () => {
    const check = await isSafeUrl("http://127.0.0.1:27017")
    expect(check.safe).toBe(false)
    expect(check.error).toContain("SSRF")
  })

  it("isSafeUrl rejects invalid protocols", async () => {
    const check = await isSafeUrl("ftp://safe-domain.com/file")
    expect(check.safe).toBe(false)
    expect(check.error).toContain("protocols")
  })
})
