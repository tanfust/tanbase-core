import { canonicalUrl } from "@/lib/site"

export const contentSignal = "ai-train=no, search=yes, ai-input=yes" as const

export const discoveryCacheControl = "public, max-age=300" as const

export const discoveryLinks = [
  `<${canonicalUrl("/llms.txt")}>; rel="describedby"; type="text/markdown"`,
  `<${canonicalUrl("/sitemap.xml")}>; rel="related"; type="application/xml"`,
] as const

const publicUrls = [canonicalUrl("/")] as const

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function createSitemapXml(urls: readonly string[] = publicUrls): string {
  const entries = urls
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
    .join("\n")

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
    "",
  ].join("\n")
}

export function createRobotsTxt(environment: string): string {
  const production = environment === "production"
  const lines = [
    "User-agent: *",
    `Content-Signal: ${contentSignal}`,
    production ? "Allow: /" : "Disallow: /",
  ]

  if (production) {
    lines.push("", `Sitemap: ${canonicalUrl("/sitemap.xml")}`)
  }

  return `${lines.join("\n")}\n`
}

export function addHomepageDiscoveryHeaders(
  request: Request,
  response: Response
): Response {
  const { pathname } = new URL(request.url)
  const contentType = response.headers.get("Content-Type") ?? ""
  const isHtmlHomepage =
    (request.method === "GET" || request.method === "HEAD") &&
    pathname === "/" &&
    response.ok &&
    contentType.toLowerCase().startsWith("text/html")

  if (!isHtmlHomepage) return response

  const decoratedResponse = new Response(response.body, response)

  for (const link of discoveryLinks) {
    decoratedResponse.headers.append("Link", link)
  }

  decoratedResponse.headers.set("Content-Signal", contentSignal)
  return decoratedResponse
}
