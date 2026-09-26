import { requireMcpAuth } from "@better-auth/mcp"
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import type { AuthInfo } from "@modelcontextprotocol/server"
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker"
import { z } from "zod"

import { getAuth, mcpResource } from "@/modules/auth/auth.server"
import type { Auth } from "@/modules/auth/auth.server"
import { taskStatuses } from "@/modules/tasks/contracts"

import {
  completeTask,
  createTaskForUser,
  listTasks,
  McpToolError,
} from "./tools.server"
import type { McpTask } from "./tools.server"

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")

const taskOutput = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().nullable(),
  status: z.enum(taskStatuses),
  parentId: z.string().nullable(),
  dueDate: z.string().nullable(),
  project: z.object({ id: z.string(), name: z.string() }),
})

function result<T extends Record<string, unknown>>(value: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  }
}

async function run<T extends Record<string, unknown>>(work: () => Promise<T>) {
  try {
    return result(await work())
  } catch (error) {
    // Expected failures become tool errors the model can read and recover
    // from; anything else is a server error.
    if (!(error instanceof McpToolError)) throw error
    return {
      isError: true,
      content: [{ type: "text" as const, text: error.message }],
    }
  }
}

/** One MCP server per request, scoped to the token's user. */
export function createTasksMcpServer(
  userId: string,
  database?: D1Database
): McpServer {
  const server = new McpServer(
    { name: "tanbase-core", title: "TanBase Core tasks", version: "1.0.0" },
    {
      jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
      instructions:
        "Tools for the signed-in user's TanBase Core task board. Dates are calendar days in YYYY-MM-DD form.",
    }
  )

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "List the user's tasks across projects, optionally filtered by project, status, or due date. Returns each task's ID, title, notes, status, due date, and project.",
      inputSchema: z.object({
        projectId: z.string().min(1).optional(),
        status: z.enum(taskStatuses).optional(),
        dueBefore: calendarDate
          .optional()
          .describe("Only tasks due on or before this date."),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      outputSchema: z.object({ tasks: z.array(taskOutput) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input) => run(() => listTasks(userId, input, database))
  )

  server.registerTool(
    "create_task",
    {
      title: "Create a task",
      description:
        "Create a task on the user's board. Without a projectId it goes to the user's first project. The task appears live on every open board.",
      inputSchema: z.object({
        title: z.string().trim().min(1).max(200),
        notes: z.string().trim().max(10_000).optional(),
        projectId: z.string().min(1).optional(),
        status: z.enum(taskStatuses).optional(),
        dueDate: calendarDate.optional(),
      }),
      outputSchema: taskOutput,
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    (input) =>
      run(async (): Promise<McpTask & Record<string, unknown>> => ({
        ...(await createTaskForUser(userId, input, database)),
      }))
  )

  server.registerTool(
    "complete_task",
    {
      title: "Complete a task",
      description:
        "Mark one of the user's tasks as done by its ID, as returned by list_tasks.",
      inputSchema: z.object({ taskId: z.string().min(1) }),
      outputSchema: taskOutput,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ taskId }) =>
      run(async (): Promise<McpTask & Record<string, unknown>> => ({
        ...(await completeTask(userId, taskId, database)),
      }))
  )

  return server
}

let handler: ReturnType<typeof createMcpHandler> | undefined

// Serves both 2026-07-28 and stateless 2025-era clients; each request gets a
// fresh server for the user named by its verified access token.
function mcpHandler() {
  handler ??= createMcpHandler(({ authInfo }) => {
    const userId = authInfo?.extra?.userId
    if (typeof userId !== "string") throw new Error("Unauthenticated request")
    return createTasksMcpServer(userId)
  })
  return handler
}

function toAuthInfo(
  request: Request,
  claims: Record<string, unknown>
): AuthInfo | null {
  if (typeof claims.sub !== "string") return null
  const scope = typeof claims.scope === "string" ? claims.scope : ""
  const clientId =
    typeof claims.azp === "string"
      ? claims.azp
      : typeof claims.client_id === "string"
        ? claims.client_id
        : ""
  return {
    token: request.headers.get("authorization")?.replace(/^\S+\s+/, "") ?? "",
    clientId,
    scopes: scope.split(" ").filter(Boolean),
    expiresAt: typeof claims.exp === "number" ? claims.exp : undefined,
    extra: { userId: claims.sub },
  }
}

/**
 * `/mcp`: verifies the bearer token against the app's JWKS (issuer, the
 * `/mcp` audience, expiry, and DPoP when bound), answers unauthenticated
 * requests with the RFC 9728 challenge, then serves MCP for the token's user.
 */
export function handleMcpRequest(
  request: Request,
  auth: Auth = getAuth()
): Promise<Response> {
  return requireMcpAuth(
    auth,
    (verified, claims) => {
      const authInfo = toAuthInfo(verified, claims)
      if (!authInfo) {
        return new Response("The access token has no subject.", { status: 401 })
      }
      return mcpHandler().fetch(verified, { authInfo })
    },
    { resource: mcpResource(auth.options.baseURL) }
  )(request)
}
