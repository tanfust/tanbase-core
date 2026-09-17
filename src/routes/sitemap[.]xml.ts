import { createFileRoute } from "@tanstack/react-router"

import {
  createSitemapXml,
  discoveryCacheControl,
} from "@/modules/seo/discovery"

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(createSitemapXml(), {
          headers: {
            "Cache-Control": discoveryCacheControl,
            "Content-Type": "application/xml; charset=utf-8",
          },
        }),
    },
  },
})
