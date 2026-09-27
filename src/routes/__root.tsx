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
import { WebMcpTools } from "@/components/web-mcp"
import { assetRecoveryScript } from "@/lib/asset-recovery"
import { siteConfig } from "@/lib/site"
import { getAnalyticsConfig } from "@/modules/analytics/config"
import { defaultRobots } from "@/modules/seo/head"

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
      // Routes opt in to indexing, with a canonical URL, through seo().
      defaultRobots,
    ],
    links: [
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
        {/* Reloads once if a fresh deployment's assets are not served yet. */}
        {!import.meta.env.DEV && <ScriptOnce>{assetRecoveryScript}</ScriptOnce>}
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics config={analytics} />
        <WebMcpTools />
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
