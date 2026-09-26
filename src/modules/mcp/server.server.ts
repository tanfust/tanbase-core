import { requireMcpAuth } from "@better-auth/mcp"
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import type { AuthInfo } from "@modelcontextprotocol/server"
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker"

import { getAuth, mcpResource } from "@/modules/auth/auth.server"
import type { Auth } from "@/modules/auth/auth.server"

import {
  completeTaskTool,
  createTaskTool,
  listTasksTool,
  mcpInstructions,
  mcpServerInfo,
} from "./tool-definitions"
import {
  completeTask,
  createTaskForUser,
  listTasks,
  McpToolError,
} from "./tools.server"
import type { McpTask } from "./tools.server"

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
  const server = new McpServer(mcpServerInfo, {
    jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
    instructions: mcpInstructions,
  })

  // registerTool reads only the config keys it knows, so each shared
  // definition doubles as its config.
  server.registerTool(listTasksTool.name, listTasksTool, (input) =>
    run(() => listTasks(userId, input, database))
  )

  server.registerTool(createTaskTool.name, createTaskTool, (input) =>
    run(async (): Promise<McpTask & Record<string, unknown>> => ({
      ...(await createTaskForUser(userId, input, database)),
    }))
  )

  server.registerTool(completeTaskTool.name, completeTaskTool, ({ taskId }) =>
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
 * `requireMcpAuth` fetches `jwksUrl` over the network, but a Worker cannot
 * fetch its own hostname: the request never reaches it. The verifier's
 * underlying `jwksFetch` also accepts a function returning the key set, and
 * `requireMcpAuth` passes the option through, so the public keys are read
 * in-process instead. The cast bridges the narrower option type; the MCP
 * tests exercise this with a real token and self-fetches disabled.
 */
function inProcessJwks(auth: Auth): string {
  const load = () => auth.api.getJwks()
  return load as unknown as string
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
    {
      resource: mcpResource(auth.options.baseURL),
      jwksUrl: inProcessJwks(auth),
    }
  )(request)
}
