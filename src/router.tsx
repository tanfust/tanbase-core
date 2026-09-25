import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { QueryClient } from "@tanstack/react-query"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { createIsomorphicFn } from "@tanstack/react-start"

import { getRequestContext } from "./platform/request-context"
import { routeTree } from "./routeTree.gen"

// The server stamps this request's CSP nonce on the scripts it renders. The
// client never renders inline scripts, so it has no nonce. The compiler strips
// the server branch and its import from the client bundle in dev and builds.
const requestNonce = createIsomorphicFn()
  .server(() => getRequestContext()?.nonce)
  .client(() => undefined)

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
    ssr: { nonce: requestNonce() },
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
