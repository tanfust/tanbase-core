import { createFileRoute } from "@tanstack/react-router"

import { createRssXml } from "@/modules/blog/feed"
import { discoveryCacheControl } from "@/modules/seo/discovery"
import { requirePublicOrigin } from "@/platform/origin"

export const Route = createFileRoute("/blog/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { listPostSummaries } =
          await import("@/modules/blog/posts.server")
        return new Response(
          createRssXml(listPostSummaries(), requirePublicOrigin()),
          {
            headers: {
              "Cache-Control": discoveryCacheControl,
              "Content-Type": "application/rss+xml; charset=utf-8",
            },
          }
        )
      },
    },
  },
})
