import { describe, expect, it } from "vitest"
import { parseGithubUrl, isFileAllowed } from "./github.scraper.service"

describe("GitHub Scraper Logic", () => {
  it("parseGithubUrl parses owner and repository correctly", () => {
    const parsed = parseGithubUrl("https://github.com/owner-name/repo-name")
    expect(parsed.owner).toBe("owner-name")
    expect(parsed.repo).toBe("repo-name")
  })

  it("parseGithubUrl rejects non-github domains", () => {
    expect(() => parseGithubUrl("https://gitlab.com/owner/repo")).toThrow()
  })

  it("isFileAllowed excludes binaries, dependencies and keys/secrets", () => {
    // Binary
    expect(isFileAllowed("assets/logo.png")).toBe(false)
    // Package lock
    expect(isFileAllowed("package-lock.json")).toBe(false)
    // Node modules
    expect(isFileAllowed("node_modules/lodash/index.js")).toBe(false)
    // Secrets
    expect(isFileAllowed(".env")).toBe(false)
    expect(isFileAllowed("config/jwt_secret.pem")).toBe(false)
    expect(isFileAllowed("src/credentials.json")).toBe(false)
    expect(isFileAllowed("keys.txt")).toBe(false)

    // Allowed code files
    expect(isFileAllowed("src/main.ts")).toBe(true)
    expect(isFileAllowed("index.html")).toBe(true)
    expect(isFileAllowed("README.md")).toBe(true)
  })
})
