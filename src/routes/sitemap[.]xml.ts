import { createFileRoute } from "@tanstack/react-router"

import {
  createSitemapXml,
  discoveryCacheControl,
  publicUrls,
} from "@/modules/seo/discovery"
import { requirePublicOrigin } from "@/platform/origin"

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { blogUrls } = await import("@/modules/blog/posts.server")
        const origin = requirePublicOrigin()
        return new Response(
          createSitemapXml([...publicUrls(origin), ...blogUrls(origin)]),
          {
            headers: {
              "Cache-Control": discoveryCacheControl,
              "Content-Type": "application/xml; charset=utf-8",
            },
          }
        )
      },
    },
  },
})
