import { createFileRoute } from "@tanstack/react-router"

import { fillTemplate } from "@/lib/site"
import { contentSignal, discoveryCacheControl } from "@/modules/seo/discovery"
import llms from "@/modules/seo/llms.txt?raw"
import { requirePublicOrigin } from "@/platform/origin"

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(fillTemplate(llms, requirePublicOrigin()), {
          headers: {
            "Cache-Control": discoveryCacheControl,
            "Content-Signal": contentSignal,
            "Content-Type": "text/markdown; charset=utf-8",
          },
        }),
    },
  },
})
