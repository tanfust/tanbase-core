import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"

import { createRobotsTxt, discoveryCacheControl } from "@/modules/seo/discovery"

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(createRobotsTxt(env.APP_ENV), {
          headers: {
            "Cache-Control": discoveryCacheControl,
            "Content-Type": "text/plain; charset=utf-8",
          },
        }),
    },
  },
})
