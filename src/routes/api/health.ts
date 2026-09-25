import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"

import { createHealthResponse } from "@/lib/health"

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        createHealthResponse(env.APP_ENV, {
          cache: {
            cache: await caches.open("health"),
            origin: new URL(request.url).origin,
          },
          database: env.DB,
          files: (env as { FILES?: R2Bucket }).FILES ?? null,
        }),
    },
  },
})
