import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const args = process.argv.slice(2)

function option(name) {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}

const siteSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/lib/site.ts"),
  "utf8"
)
const canonicalOrigin = siteSource.match(/\borigin:\s*"([^"]+)"/)?.[1]

assert.ok(canonicalOrigin, "src/lib/site.ts must define siteConfig.origin")

const environment = option("environment")
// Production defaults to the canonical origin; local runs must name their URL.
const baseUrl =
  option("url") ?? (environment === "production" ? canonicalOrigin : undefined)
const expectMarkdown = args.includes("--expect-markdown")
const allowedEnvironments = new Set(["local", "production"])

if (!baseUrl || !environment || !allowedEnvironments.has(environment)) {
  console.error(
    "Usage: pnpm smoke -- [--url <url>] --environment <local|production> [--expect-markdown]\n--url is required for local and defaults to the canonical origin for production."
  )
  process.exit(1)
}

const url = new URL(baseUrl)
const cacheControl = "public, max-age=300"
const contentSignal = "ai-train=no, search=yes, ai-input=yes"

function fetchWithTimeout(resource, init = {}) {
  return fetch(resource, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  })
}

const healthResponse = await fetchWithTimeout(new URL("/api/health", url))

assert.equal(healthResponse.status, 200, "health endpoint must return HTTP 200")
assert.match(
  healthResponse.headers.get("content-type") ?? "",
  /^application\/json\b/,
  "health endpoint must return JSON"
)
assert.equal(
  healthResponse.headers.get("cache-control"),
  "no-store",
  "health endpoint must not be cached"
)
assert.deepEqual(await healthResponse.json(), {
  status: "ok",
  service: "tanbase-core",
  environment,
  checks: { database: "ok" },
})

const rootResponse = await fetchWithTimeout(new URL("/", url))
const html = await rootResponse.text()

assert.ok(rootResponse.ok, `root must return 2xx, got ${rootResponse.status}`)
assert.match(
  rootResponse.headers.get("content-type") ?? "",
  /^text\/html\b/,
  "root must return HTML"
)
assert.match(html, /<html[\s>]/i, "root must contain a rendered document")
assert.match(html, /<title>TanBase Core<\/title>/i, "head content must render")
assert.match(
  html,
  new RegExp(
    `<link[^>]+rel="canonical"[^>]+href="${canonicalOrigin}/"[^>]*>`,
    "i"
  ),
  "root must identify the canonical production URL"
)
assert.match(
  html,
  new RegExp(
    `<meta[^>]+property="og:url"[^>]+content="${canonicalOrigin}/"[^>]*>`,
    "i"
  ),
  "root must expose the canonical Open Graph URL"
)
assert.match(html, /<script[\s>]/i, "hydration scripts must render")
assert.doesNotMatch(html, /Internal Server Error/i)
assert.equal(
  rootResponse.headers.get("content-signal"),
  contentSignal,
  "root must expose the selected Content Signals policy"
)

const protectedResponse = await fetchWithTimeout(new URL("/app", url), {
  redirect: "manual",
})
assert.ok(
  [302, 303, 307, 308].includes(protectedResponse.status),
  `protected app must redirect without a session, got ${protectedResponse.status}`
)
assert.match(
  protectedResponse.headers.get("location") ?? "",
  /^\/login\?redirect=%2Fapp(?:&|$)/,
  "protected app must preserve the requested path in the login redirect"
)

const rootLinks = rootResponse.headers.get("link") ?? ""
assert.ok(
  rootLinks.includes(
    `<${canonicalOrigin}/llms.txt>; rel="describedby"; type="text/markdown"`
  ),
  "root must advertise llms.txt"
)
assert.ok(
  rootLinks.includes(
    `<${canonicalOrigin}/sitemap.xml>; rel="related"; type="application/xml"`
  ),
  "root must advertise sitemap.xml"
)

const sitemapResponse = await fetchWithTimeout(new URL("/sitemap.xml", url))
const sitemap = await sitemapResponse.text()

assert.equal(sitemapResponse.status, 200, "sitemap must return HTTP 200")
assert.match(
  sitemapResponse.headers.get("content-type") ?? "",
  /^application\/xml\b/,
  "sitemap must return XML"
)
assert.equal(
  sitemapResponse.headers.get("cache-control"),
  cacheControl,
  "sitemap must use the discovery cache policy"
)
assert.deepEqual(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]),
  [`${canonicalOrigin}/`],
  "sitemap must list only the canonical homepage"
)

const robotsResponse = await fetchWithTimeout(new URL("/robots.txt", url))
const robots = await robotsResponse.text()

assert.equal(robotsResponse.status, 200, "robots.txt must return HTTP 200")
assert.match(
  robotsResponse.headers.get("content-type") ?? "",
  /^text\/plain\b/,
  "robots.txt must return plain text"
)
assert.equal(
  robotsResponse.headers.get("cache-control"),
  cacheControl,
  "robots.txt must use the discovery cache policy"
)
assert.match(
  robots,
  new RegExp(`^Content-Signal: ${contentSignal}$`, "m"),
  "robots.txt must expose the selected Content Signals policy"
)

if (environment === "production") {
  assert.match(
    robots,
    new RegExp(
      `^User-agent: \\*\\r?\\nContent-Signal: ${contentSignal}\\r?\\nAllow: \\/$`,
      "m"
    ),
    "production robots.txt must allow crawling in the application wildcard group"
  )
  assert.match(
    robots,
    new RegExp(`^Sitemap: ${canonicalOrigin}/sitemap\\.xml$`, "m"),
    "production robots.txt must advertise the canonical sitemap"
  )
} else {
  assert.match(
    robots,
    /^Disallow: \/$/m,
    `${environment} robots.txt must block crawling`
  )
  assert.doesNotMatch(
    robots,
    /^Sitemap:/m,
    `${environment} robots.txt must not advertise the production sitemap`
  )
}

const llmsResponse = await fetchWithTimeout(new URL("/llms.txt", url))
const llms = await llmsResponse.text()

assert.equal(llmsResponse.status, 200, "llms.txt must return HTTP 200")
assert.match(
  llmsResponse.headers.get("content-type") ?? "",
  /^text\/markdown\b/,
  "llms.txt must return Markdown"
)
assert.equal(
  llmsResponse.headers.get("cache-control"),
  cacheControl,
  "llms.txt must use the discovery cache policy"
)
assert.equal(
  llmsResponse.headers.get("content-signal"),
  contentSignal,
  "llms.txt must expose the selected Content Signals policy"
)
assert.match(llms, /^# TanBase Core$/m, "llms.txt must identify the product")
assert.ok(
  llms.includes(`${canonicalOrigin}/`),
  "llms.txt must name the canonical production origin"
)
assert.ok(
  llms.includes("does not currently expose a public application API"),
  "llms.txt must state the current capability boundary"
)

if (expectMarkdown) {
  const markdownResponse = await fetchWithTimeout(new URL("/", url), {
    headers: { Accept: "text/markdown" },
  })
  const markdown = await markdownResponse.text()

  assert.equal(
    markdownResponse.status,
    200,
    "Markdown negotiation must return HTTP 200"
  )
  assert.match(
    markdownResponse.headers.get("content-type") ?? "",
    /^text\/markdown\b/,
    "Markdown negotiation must return Markdown"
  )
  assert.ok(
    (markdownResponse.headers.get("vary") ?? "")
      .split(",")
      .some((value) => value.trim().toLowerCase() === "accept"),
    "Markdown negotiation must vary caches by Accept"
  )
  assert.equal(
    markdownResponse.headers.get("content-signal"),
    contentSignal,
    "Markdown negotiation must preserve the origin Content Signals policy"
  )

  const markdownTokens = markdownResponse.headers.get("x-markdown-tokens")
  assert.ok(
    markdownTokens !== null &&
      /^\d+$/.test(markdownTokens) &&
      Number(markdownTokens) > 0,
    "Markdown negotiation must report a positive x-markdown-tokens value"
  )
  assert.match(
    markdown,
    /^# TanBase Core$/m,
    "negotiated Markdown must contain the page heading"
  )
  assert.doesNotMatch(
    markdown,
    /<html[\s>]/i,
    "negotiated Markdown must not return the HTML document"
  )
}

console.log(`Smoke checks passed for ${environment}: ${url.origin}`)
