import { WorkerEntrypoint } from "cloudflare:workers"

import { ogCardForPath } from "./content.server"

const oneDay = 60 * 60 * 24
const oneYear = oneDay * 365

/**
 * Serves `/og/<slug>.png`. `exports.OgImage` in wrangler.jsonc turns on
 * Workers Caching for this entrypoint alone, so Cloudflare draws each image
 * once per deployed version and serves it from its cache afterwards. The
 * version is part of the cache key, so a deploy replaces every image.
 */
export class OgImage extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
      })
    }

    const card = ogCardForPath(new URL(request.url).pathname)
    if (!card) {
      return new Response("Not found", {
        status: 404,
        headers: {
          "Cache-Control": `public, max-age=${oneDay}`,
          "Content-Type": "text/plain; charset=utf-8",
        },
      })
    }

    // Loaded on first use, so pages never evaluate the renderer.
    const { renderCard } = await import("./render.server")
    const png = await renderCard(card)
    return new Response(request.method === "HEAD" ? null : png, {
      headers: {
        // Browsers and link-preview crawlers revalidate daily.
        "Cache-Control": `public, max-age=${oneDay}`,
        // Cloudflare keeps it until the next deploy changes the cache key.
        "Cloudflare-CDN-Cache-Control": `public, max-age=${oneYear}`,
        "Content-Length": String(png.byteLength),
        "Content-Type": "image/png",
      },
    })
  }
}
