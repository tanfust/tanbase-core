import { createFileRoute } from "@tanstack/react-router"

import { contentSignal, discoveryCacheControl } from "@/modules/seo/discovery"
import llms from "@/modules/seo/llms.txt?raw"

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(llms, {
          headers: {
            "Cache-Control": discoveryCacheControl,
            "Content-Signal": contentSignal,
            "Content-Type": "text/markdown; charset=utf-8",
          },
        }),
    },
  },
})
