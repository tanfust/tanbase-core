import { createFileRoute } from "@tanstack/react-router"

import { createRobotsTxt, discoveryCacheControl } from "@/modules/seo/discovery"
import { appEnvironment } from "@/platform/environment"
import { requirePublicOrigin } from "@/platform/origin"

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(createRobotsTxt(appEnvironment(), requirePublicOrigin()), {
          headers: {
            "Cache-Control": discoveryCacheControl,
            "Content-Type": "text/plain; charset=utf-8",
          },
        }),
    },
  },
})
