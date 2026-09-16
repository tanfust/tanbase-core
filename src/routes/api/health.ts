import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"

import { createHealthResponse } from "@/lib/health"

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => createHealthResponse(env.APP_ENV),
    },
  },
})
