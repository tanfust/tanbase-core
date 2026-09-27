import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const email = `views-${suffix}@example.com`
const password = "correct-horse-1"

async function waitForHydration(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("body *")].some((element) =>
      Object.keys(element).some((key) => key.startsWith("__reactProps$"))
    )
  )
}

// The local test site key always passes, but the token arrives asynchronously.
async function waitForChallenge(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(
    /.+/
  )
}

async function addTask(
  page: Page,
  task: { title: string; notes?: string; status: string; due?: string }
) {
  await page.getByRole("button", { name: "New task" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Title").fill(task.title)
  if (task.notes) await dialog.getByLabel("Notes").fill(task.notes)
  if (task.status !== "Todo") {
    await dialog.getByRole("combobox").click()
    await page.getByRole("option", { name: task.status }).click()
  }
  if (task.due) await dialog.getByLabel("Due date").fill(task.due)
  await dialog.getByRole("button", { name: "Create task" }).click()
  await expect(dialog).not.toBeVisible()
}

function rowTitles(page: Page) {
  return page
    .getByRole("table")
    .locator("tbody tr td:first-child .font-medium")
    .allTextContents()
}

test("forms validate with the shared schemas, and the list view lives in the URL", async ({
  page,
  context,
}) => {
  console.log("e2e: sign-up validation")
  await page.goto("/sign-up")
  await waitForHydration(page)
  await page.getByLabel("Name").fill("Views Test")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByLabel("Confirm password").fill("correct-horse-2")
  await page.getByRole("button", { name: "Create account" }).click()
  const confirmation = page.getByLabel("Confirm password")
  await expect(page.getByText("Passwords do not match.")).toBeVisible()
  await expect(confirmation).toHaveAttribute("aria-invalid", "true")
  // After the first submit the field revalidates as it changes.
  await confirmation.fill(password)
  await expect(page.getByText("Passwords do not match.")).not.toBeVisible()
  await expect(confirmation).not.toHaveAttribute("aria-invalid")
  await waitForChallenge(page)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "My project" })
  ).toBeVisible()

  console.log("e2e: task dialog validation")
  await page.getByRole("button", { name: "New task" }).click()
  const dialog = page.getByRole("dialog")
  // Spaces pass the browser's own required check; the schema trims them.
  await dialog.getByLabel("Title").fill("   ")
  await dialog.getByRole("button", { name: "Create task" }).click()
  await expect(dialog.getByText("Enter a task title.")).toBeVisible()
  await expect(dialog.getByLabel("Title")).toHaveAttribute(
    "aria-invalid",
    "true"
  )
  await dialog.getByRole("button", { name: "Cancel" }).click()

  await addTask(page, {
    title: "Alpha launch",
    notes: "Announce the release",
    status: "Todo",
    due: "2026-10-10",
  })
  await addTask(page, {
    title: "Beta docs",
    notes: "Write the setup guide",
    status: "Doing",
  })
  await addTask(page, { title: "Gamma review", status: "Done" })

  console.log("e2e: list view")
  await page.getByRole("tab", { name: "List" }).click()
  await expect(page).toHaveURL(/view=list/)
  await expect(page.getByRole("table")).toBeVisible()
  await expect(page.getByText("3 tasks", { exact: true })).toBeVisible()

  const titleHeader = page.getByRole("columnheader", { name: "Title" })
  await titleHeader.getByRole("button").click()
  await expect(titleHeader).toHaveAttribute("aria-sort", "ascending")
  await expect
    .poll(() => rowTitles(page))
    .toEqual(["Alpha launch", "Beta docs", "Gamma review"])
  await titleHeader.getByRole("button").click()
  await expect(titleHeader).toHaveAttribute("aria-sort", "descending")
  await expect(page).toHaveURL(/sort=title/)
  await expect(page).toHaveURL(/desc=true/)
  await expect
    .poll(() => rowTitles(page))
    .toEqual(["Gamma review", "Beta docs", "Alpha launch"])

  await page.getByRole("button", { name: "Filter by status" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Done" }).click()
  await page.keyboard.press("Escape")
  await expect.poll(() => rowTitles(page)).toEqual(["Gamma review"])
  await expect(page.getByText("1 of 3 tasks")).toBeVisible()

  await page.getByRole("searchbox", { name: "Search tasks" }).fill("guide")
  await expect(
    page.getByText("No tasks match the search and filters.")
  ).toBeVisible()
  await page.getByRole("button", { name: "Filter by status" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Done" }).click()
  await page.keyboard.press("Escape")
  // The search reads notes too.
  await expect.poll(() => rowTitles(page)).toEqual(["Beta docs"])
  await expect(page).toHaveURL(/q=guide/)

  await page.getByRole("button", { name: "Columns" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Notes" }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("columnheader", { name: "Notes" })).toHaveCount(0)
  await expect(page).toHaveURL(/hide=/)

  console.log("e2e: shared list link")
  const shared = page.url()
  const peer = await context.newPage()
  await peer.goto(shared)
  await waitForHydration(peer)
  await expect(peer.getByRole("tab", { name: "List" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await expect(
    peer.getByRole("searchbox", { name: "Search tasks" })
  ).toHaveValue("guide")
  await expect(peer.getByRole("columnheader", { name: "Notes" })).toHaveCount(0)
  await expect(
    peer.getByRole("columnheader", { name: "Title" })
  ).toHaveAttribute("aria-sort", "descending")
  await expect.poll(() => rowTitles(peer)).toEqual(["Beta docs"])
  await peer.screenshot({ path: "output/playwright/list-view.png" })
  await peer.close()

  // A malformed link still opens, on the default view.
  await page.goto("/app?view=grid&status=oops&sort=nope")
  await waitForHydration(page)
  await expect(page.getByRole("tab", { name: "Board" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await expect(page.getByRole("region", { name: "Done" })).toContainText(
    "Gamma review"
  )
})
