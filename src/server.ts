import { env } from "cloudflare:workers"
import handler from "@tanstack/react-start/server-entry"

import { getSessionFromHeaders } from "@/modules/auth/session.server"
import { discoveryResponse } from "@/modules/discovery/well-known"
import { enqueueDueReminders } from "@/modules/jobs/cron.server"
import { processReminderBatch } from "@/modules/jobs/queue.server"
import {
  corsPreflight,
  isCorsPath,
  oauthDiscoveryResponse,
  withCors,
} from "@/modules/mcp/discovery.server"
import { handleMcpRequest } from "@/modules/mcp/server.server"
import {
  getBoardNamespace,
  handleRealtimeUpgrade,
} from "@/modules/realtime/rooms.server"
import { addHomepageDiscoveryHeaders } from "@/modules/seo/discovery"
import { asPageRequest, markdownPageResponse } from "@/modules/seo/negotiation"
import { getProject } from "@/modules/tasks/repository.server"
import {
  analyticsConnectSources,
  readAnalyticsConfig,
} from "@/platform/analytics"
import { log } from "@/platform/log"
import { runWithRequestContext } from "@/platform/request-context"
import { applySecurityHeaders, createNonce } from "@/platform/security-headers"

export { TaskBreakdownWorkflow } from "@/modules/ai/breakdown-workflow.server"
export { BoardRoom } from "@/modules/realtime/board-room.server"

const realtimePath = /^\/api\/realtime\/([^/]+)$/

/** This deployment's public origin, which OAuth and MCP identifiers use. */
function appOrigin() {
  return new URL(env.BETTER_AUTH_URL).origin
}

// WebSocket upgrades go straight to the room so TanStack never wraps the 101.
async function realtimeResponse(request: Request, projectId: string) {
  const session = await getSessionFromHeaders(request.headers)
  return handleRealtimeUpgrade(request, decodeURIComponent(projectId), {
    appOrigin: appOrigin(),
    namespace: getBoardNamespace(),
    ownsProject: async (userId, id) => (await getProject(userId, id)) !== null,
    userId: session?.user.id ?? null,
  })
}

/** The page's own WebSocket origin, which `'self'` may not cover everywhere. */
function socketOrigin(request: Request) {
  const url = new URL(request.url)
  return `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`
}

// MCP, OAuth and agent discovery, Markdown pages, and realtime upgrades are
// served before TanStack Start.
async function route(request: Request, pathname: string): Promise<Response> {
  if (isCorsPath(pathname) && request.method === "OPTIONS") {
    return corsPreflight()
  }
  if (pathname === "/mcp") return handleMcpRequest(request)
  const realtime = realtimePath.exec(pathname)
  if (realtime) return realtimeResponse(request, realtime[1])
  return (
    (await oauthDiscoveryResponse(request)) ??
    (await discoveryResponse(request, appOrigin())) ??
    markdownPageResponse(request) ??
    handler.fetch(asPageRequest(request))
  )
}

function failedResponse() {
  return new Response("Something went wrong. Please try again.", {
    status: 500,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}

export default {
  async fetch(request) {
    const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID()
    const nonce = createNonce()

    return runWithRequestContext({ nonce, requestId }, async () => {
      const { pathname } = new URL(request.url)
      const cors = isCorsPath(pathname)
      let response: Response
      try {
        response = await route(request, pathname)
      } catch (error) {
        log.error("Unhandled request error", {
          event: "request.failed",
          method: request.method,
          path: new URL(request.url).pathname,
          error: error instanceof Error ? error.message : "Unknown error",
        })
        response = failedResponse()
      }

      // Upgrade responses carry a socket and cannot be copied.
      if (response.webSocket) return response

      const secured = applySecurityHeaders(
        addHomepageDiscoveryHeaders(request, response),
        {
          connectSources: [
            socketOrigin(request),
            ...analyticsConnectSources(readAnalyticsConfig(env)),
          ],
          enforceCsp: !import.meta.env.DEV,
          nonce,
          production: env.APP_ENV === "production",
          requestId,
        }
      )
      return cors ? withCors(secured) : secured
    })
  },

  // Hourly Cron Trigger: enqueue due-date reminders.
  async scheduled(controller) {
    await enqueueDueReminders(controller.scheduledTime)
  },

  // EMAIL_QUEUE consumer: deliver each reminder at most once.
  async queue(batch) {
    await processReminderBatch(batch)
  },
} satisfies ExportedHandler<Env>
