import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"

import { createHealthResponse } from "@/lib/health"
import { getBoardNamespace } from "@/modules/realtime/rooms.server"

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
          realtime: getBoardNamespace()?.getByName("health") ?? null,
          version:
            (env as { CF_VERSION_METADATA?: WorkerVersionMetadata })
              .CF_VERSION_METADATA?.id ?? null,
        }),
    },
  },
})
