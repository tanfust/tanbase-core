import { execFileSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const signupEmail = `browser-${suffix}@example.com`
const email = "browser-verified@example.com"
const initialPassword = "correct-horse-1"
const changedPassword = "correct-horse-2"
const resetPassword = "correct-horse-3"

function readD1Value(sql: string) {
  const directory = join(
    process.cwd(),
    ".wrangler/e2e-state/v3/d1/miniflare-D1DatabaseObject"
  )
  const database = readdirSync(directory).find(
    (file) => file.endsWith(".sqlite") && file !== "metadata.sqlite"
  )
  if (!database)
    throw new Error("The isolated browser-test D1 database is missing")

  return execFileSync("sqlite3", [join(directory, database), sql], {
    encoding: "utf8",
  }).trim()
}

async function waitForHydration(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("body *")].some((element) =>
      Object.keys(element).some((key) => key.startsWith("__reactProps$"))
    )
  )
}

// The local test site key always passes, but the token arrives asynchronously.
// Protected auth requests need a fresh token, so wait before each submit.
async function waitForChallenge(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(
    /.+/
  )
}

test("authentication, board CRUD, settings, persistence, and reset", async ({
  page,
}) => {
  console.log("e2e: redirect and sign-up")
  await page.goto("/app?project=preserved")
  await expect(page).toHaveURL(/\/login\?redirect=/)
  expect(
    decodeURIComponent(new URL(page.url()).searchParams.get("redirect") ?? "")
  ).toBe("/app?project=preserved")
  await waitForHydration(page)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(initialPassword)
  await waitForChallenge(page)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/app\?project=preserved$/)
  await expect(page.getByText("The board could not be loaded")).toBeVisible()
  await page
    .getByRole("button", { name: /browser-verified@example\.com/ })
    .click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto("/sign-up")
  await waitForHydration(page)
  await page.getByLabel("Name").fill("Browser Test")
  await page.getByLabel("Email").fill(signupEmail)
  await page.getByLabel("Password", { exact: true }).fill(initialPassword)
  await page.getByLabel("Confirm password").fill(initialPassword)
  await waitForChallenge(page)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(
    page.getByText("Check your email", { exact: true })
  ).toBeVisible()

  await page.goto("/login")
  await waitForHydration(page)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(initialPassword)
  await waitForChallenge(page)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/app$/)
  console.log("e2e: signed in")
  await expect(
    page.getByRole("heading", { level: 1, name: "My project" })
  ).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  await page.locator('[data-sidebar="trigger"]:visible').click()
  await expect(page.locator('[data-mobile="true"]')).toBeVisible()
  await expect(page.locator('[data-mobile="true"]')).toContainText("Projects")
  await page.keyboard.press("Escape")
  await page.setViewportSize({ width: 768, height: 900 })
  await expect(page.getByRole("region", { name: "Todo" })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })

  await page.getByRole("button", { name: "New project" }).click()
  await page.getByLabel("Name").fill("Launch plan")
  await page.getByRole("button", { name: "Save project" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Launch plan" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Project actions" }).click()
  await page.getByRole("menuitem", { name: "Rename project" }).click()
  await page.getByRole("textbox", { name: "Name" }).fill("Release plan")
  await page.getByRole("button", { name: "Save project" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Release plan" })
  ).toBeVisible()

  await page.getByRole("button", { name: "New task" }).click()
  await page.getByLabel("Title").fill("Ship the board")
  await page.getByLabel("Notes").fill("Verify the complete browser flow")
  await page.getByRole("button", { name: "Create task" }).click()
  await expect(page.getByText("Ship the board")).toBeVisible()

  await page.getByRole("button", { name: "Actions for Ship the board" }).click()
  await page.getByRole("menuitem", { name: "Move to Doing" }).click()
  await expect(page.getByRole("region", { name: "Doing" })).toContainText(
    "Ship the board"
  )
  await page.reload()
  await waitForHydration(page)
  await expect(page.getByRole("region", { name: "Doing" })).toContainText(
    "Ship the board"
  )

  await page.getByRole("button", { name: "Actions for Ship the board" }).click()
  await page.getByRole("menuitem", { name: "Edit" }).click()
  await page.getByLabel("Title").fill("Ship TanBase Core")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Ship TanBase Core")).toBeVisible()
  console.log("e2e: board CRUD persisted")

  await page.getByRole("link", { name: "Settings" }).first().click()
  await page.getByLabel("Name").fill("Browser Test Updated")
  await page.getByRole("button", { name: "Save profile" }).click()
  await expect(page.getByText("Profile updated")).toBeVisible()
  await page.getByRole("button", { name: "Dark theme" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)

  await page.getByLabel("Current password").fill(initialPassword)
  await page.getByLabel("New password", { exact: true }).fill(changedPassword)
  await page.getByLabel("Confirm new password").fill(changedPassword)
  await page.getByRole("button", { name: "Update password" }).click()
  await expect(page.getByLabel("Current password")).toHaveValue("")
  console.log("e2e: settings updated")

  await page
    .getByRole("button", { name: /browser-verified@example\.com/ })
    .click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)
  console.log("e2e: changed password accepted")

  await waitForHydration(page)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(changedPassword)
  await waitForChallenge(page)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/app$/)
  await page
    .getByRole("button", { name: /browser-verified@example\.com/ })
    .click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto("/forgot-password")
  await waitForHydration(page)
  await page.getByLabel("Email").fill(email)
  await waitForChallenge(page)
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(
    page.getByText("If the address belongs to an account")
  ).toBeVisible()
  console.log("e2e: reset requested")

  const identifier = readD1Value(
    "SELECT identifier FROM verification WHERE identifier LIKE 'reset-password:%' ORDER BY created_at DESC LIMIT 1"
  )
  expect(identifier).toMatch(/^reset-password:/)
  const token = identifier.slice("reset-password:".length)

  await page.goto(
    `/api/auth/reset-password/${encodeURIComponent(token)}?callbackURL=${encodeURIComponent("/reset-password")}`
  )
  await expect(page).toHaveURL(/\/reset-password\?token=/)
  await waitForHydration(page)
  await page.getByLabel("New password").fill(resetPassword)
  await page.getByLabel("Confirm password").fill(resetPassword)
  await page.getByRole("button", { name: "Update password" }).click()
  await expect(page.getByText("Password updated")).toBeVisible()
  console.log("e2e: password reset")

  await page.getByRole("button", { name: "Sign in" }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(resetPassword)
  await waitForChallenge(page)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/app$/)

  await page.getByRole("link", { name: "Release plan" }).click()
  await page
    .getByRole("button", { name: "Actions for Ship TanBase Core" })
    .click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByText("Ship TanBase Core")).not.toBeVisible()

  await page.getByRole("button", { name: "Project actions" }).click()
  await page.getByRole("menuitem", { name: "Delete project" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "My project" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Project actions" }).click()
  await page.getByRole("menuitem", { name: "Delete project" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByText("Create your first project")).toBeVisible()
  console.log("e2e: project and task deleted")
})

test("invalid reset tokens show a recoverable state", async ({ page }) => {
  await page.goto("/reset-password?error=INVALID_TOKEN")
  await expect(page.getByText("Invalid reset link")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Request another link" })
  ).toBeVisible()
})
