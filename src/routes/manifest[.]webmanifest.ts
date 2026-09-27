import { createFileRoute } from "@tanstack/react-router"

import { discoveryCacheControl } from "@/modules/seo/discovery"
import { webManifest } from "@/modules/seo/manifest"

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(webManifest(), null, 2), {
          headers: {
            "Cache-Control": discoveryCacheControl,
            "Content-Type": "application/manifest+json",
          },
        }),
    },
  },
})
