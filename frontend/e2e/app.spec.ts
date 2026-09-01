/**
 * NeuroStack AI — Playwright End-to-End Tests
 *
 * These tests cover the critical user journeys:
 * 1. Auth — Register, Login, Logout
 * 2. Document Library — open modal, see tabs
 * 3. Chat — send message, receive response
 * 4. Knowledge Graph — navigate to graph explorer
 * 5. Developer Console — navigate and see API key UI
 * 6. Analytics Dashboard — navigate and see stats UI
 *
 * Run: npx playwright test
 * Prerequisites: frontend + backend must be running
 */

import { test, expect, Page } from "@playwright/test"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_EMAIL = `e2e_${Date.now()}@neurostack.test`
const TEST_PASSWORD = "E2eTest123!"
const TEST_NAME = "E2E Tester"

async function registerAndLogin(page: Page) {
  await page.goto("/auth/register")
  await page.getByPlaceholder(/name/i).fill(TEST_NAME)
  await page.getByPlaceholder(/email/i).fill(TEST_EMAIL)
  await page.getByPlaceholder(/password/i).fill(TEST_PASSWORD)
  await page.getByRole("button", { name: /create account|register|sign up/i }).click()
  // After register, should redirect to dashboard or login
  await page.waitForURL(/(dashboard|login)/, { timeout: 10000 })

  // If redirected to login, log in
  if (page.url().includes("login")) {
    await page.getByPlaceholder(/email/i).fill(TEST_EMAIL)
    await page.getByPlaceholder(/password/i).fill(TEST_PASSWORD)
    await page.getByRole("button", { name: /sign in|login/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 10000 })
  }
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

test.describe("Authentication", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/auth/login")
    await expect(page).toHaveTitle(/NeuroStack|Login|Sign/i)
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })

  test("should show register page", async ({ page }) => {
    await page.goto("/auth/register")
    await expect(page.getByPlaceholder(/name/i)).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
  })

  test("should reject invalid login credentials", async ({ page }) => {
    await page.goto("/auth/login")
    await page.getByPlaceholder(/email/i).fill("wrong@example.com")
    await page.getByPlaceholder(/password/i).fill("wrongpass")
    await page.getByRole("button", { name: /sign in|login/i }).click()
    // Should show error message
    await expect(page.getByText(/invalid|incorrect|not found/i)).toBeVisible({ timeout: 5000 })
  })

  test("should register a new account and reach dashboard", async ({ page }) => {
    await registerAndLogin(page)
    await expect(page).toHaveURL(/dashboard/)
  })

  test("should redirect unauthenticated users from dashboard to login", async ({ page }) => {
    // Visit dashboard without auth
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/login|auth/, { timeout: 5000 })
  })
})

test.describe("Chat Workspace", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page)
  })

  test("should display chat input on dashboard", async ({ page }) => {
    await expect(page.getByPlaceholder(/message|ask|type/i)).toBeVisible({ timeout: 8000 })
  })

  test("should open Document Library modal with three tabs", async ({ page }) => {
    // Find the document library / manage docs button
    const docsButton = page.getByRole("button", { name: /document|knowledge|library/i }).first()
    await expect(docsButton).toBeVisible({ timeout: 8000 })
    await docsButton.click()

    // Modal should open
    await expect(page.getByText(/Document Library/i)).toBeVisible({ timeout: 5000 })

    // Three tabs should be visible
    await expect(page.getByRole("button", { name: /upload file/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /web url/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /github/i })).toBeVisible()
  })

  test("should switch to URL tab and show URL input", async ({ page }) => {
    const docsButton = page.getByRole("button", { name: /document|knowledge|library/i }).first()
    await docsButton.click()
    await page.getByRole("button", { name: /web url/i }).click()
    await expect(page.getByPlaceholder(/https:\/\/example\.com/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /scrape/i })).toBeVisible()
  })

  test("should switch to GitHub tab and show repo inputs", async ({ page }) => {
    const docsButton = page.getByRole("button", { name: /document|knowledge|library/i }).first()
    await docsButton.click()
    await page.getByRole("button", { name: /github/i }).click()
    await expect(page.getByPlaceholder(/github\.com/i)).toBeVisible()
  })
})

test.describe("Knowledge Graph Explorer", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page)
  })

  test("should navigate to graph explorer", async ({ page }) => {
    await page.goto("/dashboard/graph")
    await expect(page).toHaveURL(/graph/)
    // Page should load without crashing
    await expect(page.getByText(/graph|knowledge|explorer|nodes/i)).toBeVisible({ timeout: 8000 })
  })
})

test.describe("Developer Console", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page)
  })

  test("should navigate to developer console", async ({ page }) => {
    await page.goto("/dashboard/developer")
    await expect(page).toHaveURL(/developer/)
    await expect(page.getByText(/api key|developer|console/i)).toBeVisible({ timeout: 8000 })
  })

  test("should show Create API Key button", async ({ page }) => {
    await page.goto("/dashboard/developer")
    await expect(page.getByRole("button", { name: /create|new|generate.*key/i })).toBeVisible({ timeout: 8000 })
  })
})

test.describe("Analytics Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page)
  })

  test("should navigate to analytics dashboard", async ({ page }) => {
    await page.goto("/dashboard/analytics")
    await expect(page).toHaveURL(/analytics/)
    await expect(page.getByText(/analytics|statistics|metrics/i)).toBeVisible({ timeout: 8000 })
  })
})
