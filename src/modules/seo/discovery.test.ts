import { describe, expect, it } from "vitest"

import { canonicalUrl, siteConfig } from "@/lib/site"

import {
  addHomepageDiscoveryHeaders,
  contentSignal,
  createRobotsTxt,
  createSitemapXml,
  discoveryLinks,
  escapeXml,
} from "./discovery"

describe("site URLs", () => {
  it("builds URLs from the canonical production origin", () => {
    expect(canonicalUrl()).toBe(`${siteConfig.origin}/`)
    expect(canonicalUrl("/sitemap.xml")).toBe(
      `${siteConfig.origin}/sitemap.xml`
    )
  })
})

describe("sitemap", () => {
  it("lists only the canonical homepage by default", () => {
    expect(createSitemapXml()).toBe(
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `  <url>\n` +
        `    <loc>${siteConfig.origin}/</loc>\n` +
        `  </url>\n` +
        `</urlset>\n`
    )
  })

  it("escapes XML data values", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;")
    expect(createSitemapXml(["https://example.test/?a=1&b=2"])).toContain(
      "https://example.test/?a=1&amp;b=2"
    )
  })
})

describe("robots policy", () => {
  it("allows production crawling and advertises the canonical sitemap", () => {
    expect(createRobotsTxt("production")).toBe(
      `User-agent: *\n` +
        `Content-Signal: ${contentSignal}\n` +
        `Allow: /\n\n` +
        `Sitemap: ${siteConfig.origin}/sitemap.xml\n`
    )
  })

  it.each(["local", "preview", "unknown"])(
    "blocks %s crawling without advertising a sitemap",
    (environment) => {
      const robots = createRobotsTxt(environment)

      expect(robots).toBe(
        `User-agent: *\n` +
          `Content-Signal: ${contentSignal}\n` +
          `Disallow: /\n`
      )
      expect(robots).not.toContain("Sitemap:")
    }
  )
})

describe("homepage discovery headers", () => {
  it("decorates a successful HTML homepage without consuming its body", async () => {
    const response = new Response("<html>ready</html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })

    const decorated = addHomepageDiscoveryHeaders(
      new Request("https://example.test/"),
      response
    )

    expect(decorated).not.toBe(response)
    expect(decorated.headers.get("Content-Signal")).toBe(contentSignal)
    expect(decorated.headers.get("Link")).toBe(discoveryLinks.join(", "))
    await expect(decorated.text()).resolves.toBe("<html>ready</html>")
  })

  it("leaves non-homepage responses unchanged", () => {
    const response = new Response("ok", {
      headers: { "Content-Type": "text/html" },
    })

    expect(
      addHomepageDiscoveryHeaders(
        new Request("https://example.test/about"),
        response
      )
    ).toBe(response)
  })
})
