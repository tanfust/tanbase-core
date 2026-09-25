import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { QueryClient } from "@tanstack/react-query"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { routeTree } from "./routeTree.gen"

// The server stamps this request's CSP nonce on the scripts it renders. The
// client never renders inline scripts, so it has no nonce.
async function requestNonce() {
  if (!import.meta.env.SSR) return undefined
  const { getRequestContext } = await import("./platform/request-context")
  return getRequestContext()?.nonce
}

export async function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 10_000, retry: 1 },
      mutations: { retry: false },
    },
  })
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    ssr: { nonce: await requestNonce() },
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
