import assert from "node:assert/strict"

const args = process.argv.slice(2)

function option(name) {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}

const baseUrl = option("url")
const environment = option("environment")
const allowedEnvironments = new Set(["local", "preview", "production"])

if (!baseUrl || !environment || !allowedEnvironments.has(environment)) {
  console.error(
    "Usage: pnpm smoke -- --url <url> --environment <local|preview|production>"
  )
  process.exit(1)
}

const url = new URL(baseUrl)
const canonicalOrigin = "https://tanbase-core.tanfust.com"
const cacheControl = "public, max-age=300"
const contentSignal = "ai-train=no, search=yes, ai-input=yes"

function fetchWithTimeout(resource) {
  return fetch(resource, { signal: AbortSignal.timeout(15_000) })
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
    /^Allow: \/$/m,
    "production robots.txt must allow crawling"
  )
  assert.doesNotMatch(
    robots,
    /^Disallow:/m,
    "production robots.txt must not block crawling"
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

console.log(`Smoke checks passed for ${environment}: ${url.origin}`)
