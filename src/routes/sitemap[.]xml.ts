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
      GET: () =>
        new Response(createSitemapXml(publicUrls(requirePublicOrigin())), {
          headers: {
            "Cache-Control": discoveryCacheControl,
            "Content-Type": "application/xml; charset=utf-8",
          },
        }),
    },
  },
})
