import { describe, expect, it } from "vitest"

import { siteConfig } from "@/lib/site"

import {
  defaultRobots,
  documentTitle,
  jsonLd,
  seo,
  softwareSourceCode,
} from "./head"

function metaContent(
  meta: ReturnType<typeof seo>["meta"],
  key: "name" | "property",
  value: string
) {
  return meta.find(
    (entry) => (entry as Record<string, unknown>)[key] === value
  ) as { content: string } | undefined
}

describe("document titles", () => {
  it("puts the page name before the site name", () => {
    expect(documentTitle("Sign in")).toBe("Sign in · TanBase Core")
  })

  it("names the site and its tagline on the homepage", () => {
    expect(documentTitle()).toBe(`${siteConfig.name}: ${siteConfig.tagline}`)
  })
})

describe("seo() for indexable pages", () => {
  const head = seo({
    path: "/",
    description: "A description.",
    structuredData: softwareSourceCode(),
  })

  it("emits one canonical link on the production origin", () => {
    expect(head.links).toEqual([
      { rel: "canonical", href: `${siteConfig.origin}/` },
    ])
  })

  it("allows indexing and mirrors the page in Open Graph", () => {
    expect(head.meta).toContainEqual({ title: documentTitle() })
    expect(metaContent(head.meta, "name", "robots")?.content).toBe(
      "index, follow"
    )
    expect(metaContent(head.meta, "name", "description")?.content).toBe(
      "A description."
    )
    expect(metaContent(head.meta, "property", "og:url")?.content).toBe(
      `${siteConfig.origin}/`
    )
    expect(metaContent(head.meta, "property", "og:title")?.content).toBe(
      documentTitle()
    )
    expect(metaContent(head.meta, "property", "og:description")?.content).toBe(
      "A description."
    )
    expect(metaContent(head.meta, "name", "twitter:card")?.content).toBe(
      "summary"
    )
  })

  it("renders structured data as a JSON-LD script", () => {
    expect(head.scripts).toEqual([
      {
        type: "application/ld+json",
        children: jsonLd(softwareSourceCode()),
      },
    ])
  })

  it("defaults the description to the site description", () => {
    const { meta } = seo({ path: "/" })
    expect(metaContent(meta, "name", "description")?.content).toBe(
      siteConfig.description
    )
  })
})

describe("seo() for noindex pages", () => {
  const head = seo({ title: "Settings", noindex: true })

  it("keeps the page out of search results without a canonical URL", () => {
    expect(head.meta).toContainEqual(defaultRobots)
    expect(head.links).toEqual([])
    expect(head.scripts).toEqual([])
    expect(metaContent(head.meta, "property", "og:url")).toBeUndefined()
  })

  it("still titles the page for tabs and link previews", () => {
    expect(head.meta).toContainEqual({ title: "Settings · TanBase Core" })
    expect(metaContent(head.meta, "property", "og:title")?.content).toBe(
      "Settings · TanBase Core"
    )
  })
})

describe("SoftwareSourceCode structured data", () => {
  it("describes the public MIT repository", () => {
    expect(softwareSourceCode()).toMatchObject({
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: siteConfig.name,
      url: `${siteConfig.origin}/`,
      codeRepository: siteConfig.sourceRepository,
      programmingLanguage: "TypeScript",
      runtimePlatform: "Cloudflare Workers",
      license: "https://spdx.org/licenses/MIT.html",
    })
  })

  it("cannot close its script element early", () => {
    const script = jsonLd({ name: "</script><script>alert(1)</script>" })
    expect(script).not.toContain("<")
    expect(JSON.parse(script)).toEqual({
      name: "</script><script>alert(1)</script>",
    })
  })
})
