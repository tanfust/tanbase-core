import handler from "@tanstack/react-start/server-entry"

import { addHomepageDiscoveryHeaders } from "@/modules/seo/discovery"

export default {
  async fetch(request) {
    const response = await handler.fetch(request)
    return addHomepageDiscoveryHeaders(request, response)
  },
} satisfies ExportedHandler<Env>
