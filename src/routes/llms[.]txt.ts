import { createFileRoute } from "@tanstack/react-router"

import { siteConfig } from "@/lib/site"
import { contentSignal, discoveryCacheControl } from "@/modules/seo/discovery"
import llms from "@/modules/seo/llms.txt?raw"
import { requirePublicOrigin } from "@/platform/origin"

// The file names the TanBase demo's origin; each deployment serves its own.
function llmsForOrigin(origin: string): string {
  return llms.replaceAll(siteConfig.origin, origin)
}

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(llmsForOrigin(requirePublicOrigin()), {
          headers: {
            "Cache-Control": discoveryCacheControl,
            "Content-Signal": contentSignal,
            "Content-Type": "text/markdown; charset=utf-8",
          },
        }),
    },
  },
})
