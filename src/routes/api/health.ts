import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"

import { createHealthResponse } from "@/lib/health"

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        createHealthResponse(env.APP_ENV, env.DB, {
          cache: await caches.open("health"),
          key: new URL("/api/health/database-check", request.url).toString(),
        }),
    },
  },
})
