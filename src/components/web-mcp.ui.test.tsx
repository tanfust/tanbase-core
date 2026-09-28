import { render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { findModelContext } from "@/modules/mcp/model-context"
import type { ModelContext, WebMcpTool } from "@/modules/mcp/model-context"
import { registerTaskTools, taskWebMcpTools } from "@/modules/mcp/web-mcp"

import { WebMcpTools } from "./web-mcp"

const rpc = vi.hoisted(() => ({
  listTasksInBrowser: vi.fn(),
  createTaskInBrowser: vi.fn(),
  completeTaskInBrowser: vi.fn(),
}))
vi.mock("@/modules/mcp/browser-tools", () => rpc)

function fakeModelContext() {
  const tools = new Map<string, WebMcpTool>()
  const modelContext: ModelContext = {
    registerTool: vi.fn((registered: WebMcpTool, options = {}) => {
      tools.set(registered.name, registered)
      options.signal?.addEventListener("abort", () =>
        tools.delete(registered.name)
      )
      return Promise.resolve()
    }),
  }
  return { modelContext, tools }
}

function tool(name: string) {
  const found = taskWebMcpTools().find((candidate) => candidate.name === name)
  if (!found) throw new Error(`No ${name} tool`)
  return found
}

afterEach(() => {
  vi.clearAllMocks()
  delete (document as { modelContext?: unknown }).modelContext
})

describe("findModelContext", () => {
  const context = { registerTool: () => undefined }

  it("prefers the spec's document.modelContext", () => {
    const legacy = { registerTool: () => undefined }
    expect(
      findModelContext({
        document: { modelContext: context },
        navigator: { modelContext: legacy },
      })
    ).toBe(context)
  })

  it("falls back to navigator.modelContext", () => {
    expect(
      findModelContext({ document: {}, navigator: { modelContext: context } })
    ).toBe(context)
  })

  it("returns null without a usable modelContext", () => {
    expect(findModelContext({ document: {}, navigator: {} })).toBeNull()
    expect(
      findModelContext({ document: { modelContext: {} }, navigator: {} })
    ).toBeNull()
  })
})

describe("task tools", () => {
  it("describe their inputs as JSON Schema and mark reads", () => {
    const list = tool("list_tasks")
    expect(list.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    })
    expect(tool("create_task").inputSchema).toMatchObject({
      type: "object",
      required: ["title"],
    })
  })

  it("return the server's value", async () => {
    rpc.createTaskInBrowser.mockResolvedValue({
      ok: true,
      value: { id: "t1", title: "Plan" },
    })

    await expect(
      tool("create_task").execute({ title: "Plan" })
    ).resolves.toEqual({ id: "t1", title: "Plan" })
    expect(rpc.createTaskInBrowser).toHaveBeenCalledWith({
      data: { title: "Plan" },
    })
  })

  it("reject with the server's message", async () => {
    rpc.completeTaskInBrowser.mockResolvedValue({
      ok: false,
      error: "Task not found.",
    })

    await expect(
      tool("complete_task").execute({ taskId: "missing" })
    ).rejects.toThrow("Task not found.")
  })

  it("leave validation to the server", async () => {
    rpc.listTasksInBrowser.mockResolvedValue({
      ok: false,
      error: "✖ Too big: expected number to be <=100\n  → at limit",
    })

    await expect(tool("list_tasks").execute({ limit: 500 })).rejects.toThrow(
      /limit/
    )
    expect(rpc.listTasksInBrowser).toHaveBeenCalledWith({
      data: { limit: 500 },
    })
  })

  it("send an empty object when the agent passes no input", async () => {
    rpc.listTasksInBrowser.mockResolvedValue({ ok: true, value: { tasks: [] } })

    await tool("list_tasks").execute(undefined)
    expect(rpc.listTasksInBrowser).toHaveBeenCalledWith({ data: {} })
  })
})

describe("registerTaskTools", () => {
  it("registers every tool until the signal aborts", () => {
    const { modelContext, tools } = fakeModelContext()
    const controller = new AbortController()

    registerTaskTools(modelContext, controller.signal)
    expect([...tools.keys()]).toEqual([
      "list_tasks",
      "create_task",
      "complete_task",
    ])

    controller.abort()
    expect(tools.size).toBe(0)
  })

  it("unregisters through the handle early builds return", () => {
    const unregister = vi.fn()
    const controller = new AbortController()

    registerTaskTools(
      { registerTool: () => ({ unregister }) },
      controller.signal
    )
    controller.abort()

    expect(unregister).toHaveBeenCalledTimes(3)
  })

  it("keeps going when a registration fails", () => {
    const registerTool = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new DOMException("Duplicate", "InvalidStateError")
      })
      .mockImplementation(() => Promise.reject(new Error("Rejected")))

    expect(() =>
      registerTaskTools({ registerTool }, new AbortController().signal)
    ).not.toThrow()
    expect(registerTool).toHaveBeenCalledTimes(3)
  })
})

describe("WebMcpTools", () => {
  it("registers the tools on mount and removes them on unmount", async () => {
    const { modelContext, tools } = fakeModelContext()
    Object.assign(document, { modelContext })

    const { unmount } = render(<WebMcpTools />)
    await waitFor(() => expect(tools.size).toBe(3))

    unmount()
    expect(tools.size).toBe(0)
  })

  it("does nothing without WebMCP", () => {
    expect(() => render(<WebMcpTools />).unmount()).not.toThrow()
  })
})
