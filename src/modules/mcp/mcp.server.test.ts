import { env } from "cloudflare:workers"
import { createMcpHandler } from "@modelcontextprotocol/server"
import { describe, expect, it } from "vitest"

import { mcpResource } from "@/modules/auth/auth.server"
import {
  createProject,
  createTask,
  getTask,
  listProjects,
} from "@/modules/tasks/repository.server"

import { oauthDiscoveryResponse } from "./discovery.server"
import { createTasksMcpServer, handleMcpRequest } from "./server.server"
import {
  completeTask,
  createTaskForUser,
  dueAtFromDate,
  listTasks,
  McpToolError,
} from "./tools.server"

const origin = "http://localhost:3000"

function user() {
  return `mcp-${crypto.randomUUID()}`
}

async function board(userId: string) {
  const launch = await createProject(userId, { name: "Launch" }, env.DB)
  const home = await createProject(userId, { name: "Home" }, env.DB)
  const draft = await createTask(
    userId,
    {
      projectId: launch.id,
      title: "Draft copy",
      dueAt: dueAtFromDate("2031-03-10"),
    },
    env.DB
  )
  const ship = await createTask(
    userId,
    {
      projectId: launch.id,
      title: "Ship",
      status: "doing",
      dueAt: dueAtFromDate("2031-03-20"),
    },
    env.DB
  )
  const chores = await createTask(
    userId,
    { projectId: home.id, title: "Chores" },
    env.DB
  )
  return { chores, draft, home, launch, ship }
}

describe("MCP task tools", () => {
  it("lists only the owner's tasks, filtered by project, status, and due date", async () => {
    const owner = user()
    const { draft, launch, ship } = await board(owner)
    await board(user())

    const all = await listTasks(owner, {}, env.DB)
    expect(all.tasks).toHaveLength(3)

    const inLaunch = await listTasks(owner, { projectId: launch.id }, env.DB)
    expect(inLaunch.tasks.map((task) => task.title).sort()).toEqual([
      "Draft copy",
      "Ship",
    ])

    const doing = await listTasks(owner, { status: "doing" }, env.DB)
    expect(doing.tasks.map((task) => task.id)).toEqual([ship.id])

    const dueByTenth = await listTasks(
      owner,
      { dueBefore: "2031-03-10" },
      env.DB
    )
    expect(dueByTenth.tasks).toEqual([
      {
        id: draft.id,
        title: "Draft copy",
        notes: null,
        status: "todo",
        parentId: null,
        dueDate: "2031-03-10",
        project: { id: launch.id, name: "Launch" },
      },
    ])
  })

  it("creates tasks in the first or a named project with a calendar due date", async () => {
    const owner = user()
    const { home } = await board(owner)
    // The same first project the board opens.
    const [first] = await listProjects(owner, env.DB)

    const created = await createTaskForUser(
      owner,
      { title: "From Claude", dueDate: "2031-04-01" },
      env.DB
    )
    expect(created).toMatchObject({
      title: "From Claude",
      status: "todo",
      dueDate: "2031-04-01",
      project: { id: first.id, name: first.name },
    })

    const named = await createTaskForUser(
      owner,
      { title: "Groceries", projectId: home.id, notes: "Milk" },
      env.DB
    )
    expect(named).toMatchObject({ notes: "Milk", project: { name: "Home" } })

    await expect(
      createTaskForUser(owner, { title: "x", projectId: "nope" }, env.DB)
    ).rejects.toThrow(McpToolError)
    await expect(
      createTaskForUser(owner, { title: "x", dueDate: "2031-02-30" }, env.DB)
    ).rejects.toThrow("not a valid date")
  })

  it("creates the default project for a user with none", async () => {
    const owner = user()
    const task = await createTaskForUser(owner, { title: "First" }, env.DB)
    expect(task.project.name).toEqual(expect.any(String))
  })

  it("completes only the owner's tasks", async () => {
    const owner = user()
    const { draft } = await board(owner)

    await expect(completeTask(user(), draft.id, env.DB)).rejects.toThrow(
      "Task not found."
    )
    await expect(completeTask(owner, draft.id, env.DB)).resolves.toMatchObject({
      id: draft.id,
      status: "done",
    })
    expect((await getTask(owner, draft.id, env.DB))?.status).toBe("done")
  })
})

describe("MCP protocol", () => {
  async function call(userId: string, method: string, params?: unknown) {
    const handler = createMcpHandler(() => createTasksMcpServer(userId, env.DB))
    const response = await handler.fetch(
      new Request(`${origin}/mcp`, {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-06-18",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      })
    )
    const text = await response.text()
    // Stateless legacy responses may arrive as a one-event SSE stream.
    const json = text.startsWith("{")
      ? text
      : text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          ?.slice("data: ".length)
    return JSON.parse(json ?? "null") as {
      result?: Record<string, unknown>
      error?: unknown
    }
  }

  it("lists the three tools with schemas and annotations", async () => {
    const { result } = await call(user(), "tools/list")
    const tools = result?.tools as {
      name: string
      inputSchema: unknown
      annotations?: { readOnlyHint?: boolean }
    }[]
    expect(tools.map((tool) => tool.name)).toEqual([
      "list_tasks",
      "create_task",
      "complete_task",
    ])
    expect(tools[0]?.annotations?.readOnlyHint).toBe(true)
  })

  it("calls tools as the token's user and reports tool errors to the model", async () => {
    const owner = user()
    await board(owner)

    const listed = await call(owner, "tools/call", {
      name: "list_tasks",
      arguments: { status: "doing" },
    })
    expect(listed.result?.structuredContent).toMatchObject({
      tasks: [{ title: "Ship", status: "doing" }],
    })

    const missing = await call(owner, "tools/call", {
      name: "complete_task",
      arguments: { taskId: "not-a-task" },
    })
    expect(missing.result).toMatchObject({
      isError: true,
      content: [{ type: "text", text: "Task not found." }],
    })

    const invalid = await call(owner, "tools/call", {
      name: "create_task",
      arguments: { title: "Bad date", dueDate: "March 3" },
    })
    expect(JSON.stringify(invalid)).toContain("YYYY-MM-DD")
  })
})

describe("MCP authorization", () => {
  it("challenges requests without a token with protected resource metadata", async () => {
    const response = await handleMcpRequest(
      new Request(`${origin}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })
    )

    expect(response.status).toBe(401)
    const challenge = response.headers.get("WWW-Authenticate") ?? ""
    expect(challenge).toMatch(/^Bearer /)
    expect(challenge).toContain("resource_metadata=")
    expect(challenge).toContain("/.well-known/oauth-protected-resource")
  })

  it("rejects a forged bearer token", async () => {
    const response = await handleMcpRequest(
      new Request(`${origin}/mcp`, {
        method: "POST",
        headers: {
          Authorization: "Bearer not.a.token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })
    )
    expect(response.status).toBe(401)
  })

  it("serves protected resource and authorization server metadata at the root", async () => {
    const resource = await oauthDiscoveryResponse(
      new Request(`${origin}/.well-known/oauth-protected-resource/mcp`)
    )
    expect(resource?.status).toBe(200)
    await expect(resource?.json()).resolves.toMatchObject({
      resource: mcpResource(origin),
      authorization_servers: [`${origin}/api/auth`],
    })

    const server = await oauthDiscoveryResponse(
      new Request(`${origin}/.well-known/oauth-authorization-server/api/auth`)
    )
    expect(server?.status).toBe(200)
    await expect(server?.json()).resolves.toMatchObject({
      issuer: `${origin}/api/auth`,
      authorization_endpoint: `${origin}/api/auth/oauth2/authorize`,
      token_endpoint: `${origin}/api/auth/oauth2/token`,
      registration_endpoint: `${origin}/api/auth/oauth2/register`,
      code_challenge_methods_supported: ["S256"],
    })

    expect(oauthDiscoveryResponse(new Request(`${origin}/app`))).toBeNull()
  })
})
