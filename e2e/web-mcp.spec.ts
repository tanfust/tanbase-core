import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

const email = "webmcp-verified@example.com"
const password = "correct-horse-1"

interface ToolCall {
  value?: { id?: string; title?: string; status?: string; tasks?: unknown[] }
  error?: string
}

// Stands in for a browser's WebMCP before any page script runs, recording the
// tools the page registers the way an agent would see them.
function installModelContext(page: Page) {
  return page.addInitScript(() => {
    const tools = new Map<string, { execute: (input: unknown) => unknown }>()
    Object.defineProperty(navigator, "modelContext", {
      configurable: true,
      value: {
        registerTool(
          tool: { name: string; execute: (input: unknown) => unknown },
          options: { signal?: AbortSignal } = {}
        ) {
          tools.set(tool.name, tool)
          options.signal?.addEventListener("abort", () =>
            tools.delete(tool.name)
          )
          return Promise.resolve()
        },
      },
    })
    Object.assign(window, { webMcpTools: tools })
  })
}

function toolNames(page: Page) {
  return page.evaluate(() =>
    [
      ...(
        window as unknown as { webMcpTools: Map<string, unknown> }
      ).webMcpTools.keys(),
    ].sort()
  )
}

function callTool(page: Page, name: string, input: unknown): Promise<ToolCall> {
  return page.evaluate(
    async ([toolName, toolInput]) => {
      const tools = (
        window as unknown as {
          webMcpTools: Map<string, { execute: (input: unknown) => unknown }>
        }
      ).webMcpTools
      try {
        return {
          value: (await tools.get(toolName)?.execute(toolInput)) as never,
        }
      } catch (error) {
        return { error: (error as Error).message }
      }
    },
    [name, input] as const
  )
}

test("WebMCP tools list, create, and complete the signed-in person's tasks", async ({
  page,
}) => {
  await installModelContext(page)

  await page.goto("/")
  await expect
    .poll(() => toolNames(page))
    .toEqual(["complete_task", "create_task", "list_tasks"])
  expect((await callTool(page, "list_tasks", {})).error).toMatch(
    /not signed in/
  )

  await page.goto("/login")
  await page.waitForFunction(() =>
    [...document.querySelectorAll("body *")].some((element) =>
      Object.keys(element).some((key) => key.startsWith("__reactProps$"))
    )
  )
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(
    /.+/
  )
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "My project" })
  ).toBeVisible()
  await expect.poll(() => toolNames(page)).toHaveLength(3)

  expect((await callTool(page, "create_task", { title: "" })).error).toMatch(
    /title/
  )

  const created = await callTool(page, "create_task", {
    title: "Filed by WebMCP",
    dueDate: "2031-05-01",
  })
  expect(created.error).toBeUndefined()
  expect(created.value).toMatchObject({
    title: "Filed by WebMCP",
    status: "todo",
    dueDate: "2031-05-01",
    project: { name: "My Project" },
  })
  // The board hears about the task over its live connection.
  await expect(page.getByRole("region", { name: "Todo" })).toContainText(
    "Filed by WebMCP"
  )

  const listed = await callTool(page, "list_tasks", { status: "todo" })
  expect(listed.value?.tasks).toContainEqual(
    expect.objectContaining({ id: created.value?.id })
  )

  const completed = await callTool(page, "complete_task", {
    taskId: created.value?.id,
  })
  expect(completed.value).toMatchObject({ status: "done" })
  await expect(page.getByRole("region", { name: "Done" })).toContainText(
    "Filed by WebMCP"
  )
})
