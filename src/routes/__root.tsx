import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import { Analytics } from "@/components/analytics"
import { ErrorPage, NotFoundPage } from "@/components/status-page"
import { ThemeProvider, themeScript } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"
import { canonicalUrl, siteConfig } from "@/lib/site"
import { getAnalyticsConfig } from "@/modules/analytics/config"

import appCss from "../styles.css?url"

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // Configuration only changes with a deployment, so load it once per visit.
  loader: () => getAnalyticsConfig(),
  staleTime: Number.POSITIVE_INFINITY,
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: siteConfig.name,
      },
      {
        name: "description",
        content: siteConfig.description,
      },
      {
        property: "og:url",
        content: canonicalUrl(),
      },
    ],
    links: [
      {
        rel: "canonical",
        href: canonicalUrl(),
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const analytics = Route.useLoaderData()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Runs before paint to avoid a theme flash; carries the CSP nonce. */}
        <ScriptOnce>{themeScript}</ScriptOnce>
      </head>
      <body>
        <ThemeProvider>
          <Toaster>{children}</Toaster>
        </ThemeProvider>
        <Analytics config={analytics} />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
