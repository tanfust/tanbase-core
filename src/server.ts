import { env } from "cloudflare:workers"
import handler from "@tanstack/react-start/server-entry"

import { addHomepageDiscoveryHeaders } from "@/modules/seo/discovery"
import { log } from "@/platform/log"
import { runWithRequestContext } from "@/platform/request-context"
import { applySecurityHeaders, createNonce } from "@/platform/security-headers"

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
      let response: Response
      try {
        response = await handler.fetch(request)
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

      return applySecurityHeaders(
        addHomepageDiscoveryHeaders(request, response),
        {
          enforceCsp: !import.meta.env.DEV,
          nonce,
          production: env.APP_ENV === "production",
          requestId,
        }
      )
    })
  },
} satisfies ExportedHandler<Env>
