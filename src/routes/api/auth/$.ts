import { createFileRoute } from "@tanstack/react-router"

import { getAuth } from "@/modules/auth/auth.server"

function handleAuthRequest({ request }: { request: Request }) {
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
