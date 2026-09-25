import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"

import { getAuth } from "@/modules/auth/auth.server"
import { limitAuthRequest } from "@/modules/auth/rate-limit.server"

async function handleAuthRequest({ request }: { request: Request }) {
  const limited = await limitAuthRequest(request, env.AUTH_LIMITER)
  if (limited) return limited

  return getAuth().handler(request)
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handleAuthRequest,
      POST: handleAuthRequest,
    },
  },
})
