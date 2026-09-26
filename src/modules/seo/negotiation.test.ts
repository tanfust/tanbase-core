import { describe, expect, it } from "vitest"

import { canonicalUrl } from "@/lib/site"

import { contentSignal, discoveryCacheControl } from "./discovery"
import { createHomepageMarkdown, homepage } from "./homepage"
import {
  asPageRequest,
  estimateTokens,
  markdownPageResponse,
  prefersMarkdown,
} from "./negotiation"

const browserAccept =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

function request(path: string, accept?: string, method = "GET") {
  return new Request(`https://example.test${path}`, {
    method,
    headers: accept ? { Accept: accept } : {},
  })
}

describe("Markdown preference", () => {
  it.each([
    ["text/markdown", true],
    ["text/markdown, text/plain, */*", true],
    ["text/markdown, text/html", true],
    ["text/html;q=0.5, text/markdown", true],
    ["text/html, text/markdown;q=0.5", false],
    ["text/markdown;q=0", false],
    [browserAccept, false],
    ["*/*", false],
    ["application/json", false],
  ])("%s prefers Markdown: %s", (accept, expected) => {
    expect(prefersMarkdown(accept)).toBe(expected)
  })

  it("treats a missing Accept header as HTML", () => {
    expect(prefersMarkdown(null)).toBe(false)
  })
})

describe("page requests", () => {
  it("asks TanStack Start for HTML when the client rules it out", () => {
    const page = asPageRequest(
      request("/.well-known/missing", "application/json")
    )
    expect(page.headers.get("Accept")).toBe("text/html")
    expect(page.url).toBe("https://example.test/.well-known/missing")
  })

  it.each([browserAccept, "*/*", "text/html"])(
    "keeps a request that already admits HTML: %s",
    (accept) => {
      const original = request("/", accept)
      expect(asPageRequest(original)).toBe(original)
    }
  )

  it("keeps requests without an Accept header", () => {
    const original = request("/")
    expect(asPageRequest(original)).toBe(original)
  })

  it.each([
    ["/api/health", "GET"],
    ["/_serverFn/abc", "GET"],
    ["/", "POST"],
  ])("leaves %s %s requests alone", (path, method) => {
    const original = request(path, "application/json", method)
    expect(asPageRequest(original)).toBe(original)
  })
})

describe("Markdown pages", () => {
  it("serves the homepage as Markdown with the negotiation headers", async () => {
    const response = markdownPageResponse(request("/", "text/markdown"))
    const markdown = createHomepageMarkdown()

    expect(response?.status).toBe(200)
    expect(response?.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    )
    expect(response?.headers.get("Vary")).toBe("Accept")
    expect(response?.headers.get("Content-Signal")).toBe(contentSignal)
    expect(response?.headers.get("Cache-Control")).toBe(discoveryCacheControl)
    expect(response?.headers.get("x-markdown-tokens")).toBe(
      String(estimateTokens(markdown))
    )
    await expect(response?.text()).resolves.toBe(markdown)
  })

  it("answers HEAD without a body", async () => {
    const response = markdownPageResponse(request("/", "text/markdown", "HEAD"))
    expect(response?.headers.get("Content-Type")).toMatch(/^text\/markdown/)
    await expect(response?.text()).resolves.toBe("")
  })

  it.each([
    ["/", browserAccept],
    ["/", undefined],
    ["/login", "text/markdown"],
    ["/api/health", "text/markdown"],
  ])("does not answer %s with Accept %s", (path, accept) => {
    expect(markdownPageResponse(request(path, accept))).toBeNull()
  })

  it("renders the homepage copy with absolute links", () => {
    const markdown = createHomepageMarkdown()

    expect(markdown).toMatch(/^---\ntitle: TanBase Core\n/)
    expect(markdown).toContain(`# ${homepage.title}\n`)
    expect(markdown).toContain(homepage.summary)
    expect(markdown).toContain(
      `[${homepage.source.label}](${homepage.source.href})`
    )
    expect(markdown).toContain(
      `[${homepage.demo.label}](${canonicalUrl(homepage.demo.path)})`
    )
    expect(markdown).not.toMatch(/<[a-z]/i)
  })

  it("carries the primitive map, cost model, and deploy steps", () => {
    const markdown = createHomepageMarkdown()
    const { primitives, cost, deploy } = homepage

    expect(markdown).toContain(`## ${primitives.heading}\n`)
    for (const { feature, product, bindings } of primitives.items) {
      expect(markdown).toContain(
        `| ${feature} | ${product} | ${bindings.map((name) => `\`${name}\``).join(", ")} |`
      )
    }
    expect(markdown).toContain(`## ${cost.heading}\n`)
    for (const { product, included } of cost.allowances) {
      expect(markdown).toContain(`| ${product} | ${included}`)
    }
    expect(markdown).toContain(
      "| Workers AI | 10,000 Neurons a day (free tier on every plan) |"
    )
    expect(markdown).not.toMatch(/invoice/i)
    expect(markdown).toContain(`## ${deploy.heading}\n`)
    expect(markdown).toContain(
      `\`\`\`sh\n${deploy.commands.join("\n")}\n\`\`\``
    )
    expect(markdown).toContain(`[${deploy.guide.label}](${deploy.guide.href})`)
  })
})
