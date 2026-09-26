import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { parse } from "jsonc-parser"

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
// Comma-separated Worker version IDs, one of which the target must serve.
const expectedVersions = option("expect-version")?.split(",") ?? null
// Exit status while the edge still serves another version, so the
// post-deploy runner can keep waiting instead of reporting a failure.
const notYetServedStatus = 3
const allowedEnvironments = new Set(["local", "production"])

if (!baseUrl || !environment || !allowedEnvironments.has(environment)) {
  console.error(
    "Usage: pnpm smoke -- [--url <url>] --environment <local|production> [--expect-markdown] [--expect-version <id,...>]\n--url is required for local and defaults to the canonical origin for production."
  )
  process.exit(1)
}

const url = new URL(baseUrl)
const cacheControl = "public, max-age=300"
const contentSignal = "ai-train=no, search=yes, ai-input=yes"

// The deployed environment's Wrangler settings, which smoke uses to know
// which optional features the target should expose.
function environmentConfig(name) {
  const config = parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../wrangler.jsonc"),
      "utf8"
    )
  )
  return (name === "production" ? config.env?.production : config) ?? {}
}

function turnstileSiteKey(name) {
  return environmentConfig(name).vars?.TURNSTILE_SITE_KEY || null
}

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

const health = await healthResponse.json()

if (expectedVersions && !expectedVersions.includes(health.version)) {
  console.error(
    `${url.origin} serves Worker version ${health.version ?? "unknown"}, not ${expectedVersions.join(" or ")}.`
  )
  process.exit(notYetServedStatus)
}

assert.ok(
  environmentConfig(environment).version_metadata
    ? typeof health.version === "string" && health.version.length > 0
    : health.version === null,
  "health endpoint must report the running Worker version"
)
assert.deepEqual(health, {
  status: "ok",
  service: "tanbase-core",
  environment,
  version: health.version,
  checks: {
    database: "ok",
    files: environmentConfig(environment).r2_buckets?.some(
      (bucket) => bucket.binding === "FILES"
    )
      ? "ok"
      : "disabled",
    realtime: environmentConfig(environment).durable_objects?.bindings?.some(
      (binding) => binding.name === "BOARD"
    )
      ? "ok"
      : "disabled",
  },
})

// MCP: an unauthenticated call is challenged toward the OAuth discovery chain
// that MCP clients such as Claude follow. Identifiers derive from the
// configured auth URL; documents are fetched from the target under test.
const authOrigin = new URL(
  environmentConfig(environment).vars?.BETTER_AUTH_URL ?? url.origin
)
const mcpResource = new URL("/mcp", authOrigin).href
const mcpChallenge = await fetchWithTimeout(new URL("/mcp", url), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
})
assert.equal(mcpChallenge.status, 401, "/mcp must require an access token")
const resourceMetadataUrl = /resource_metadata="([^"]+)"/.exec(
  mcpChallenge.headers.get("www-authenticate") ?? ""
)?.[1]
assert.equal(
  resourceMetadataUrl,
  new URL("/.well-known/oauth-protected-resource/mcp", authOrigin).href,
  "/mcp must point clients at its protected resource metadata"
)
const resourceMetadata = await (
  await fetchWithTimeout(new URL(new URL(resourceMetadataUrl).pathname, url))
).json()
assert.equal(resourceMetadata.resource, mcpResource)
const issuer = new URL(resourceMetadata.authorization_servers?.[0] ?? "")
const serverMetadata = await (
  await fetchWithTimeout(
    new URL(`/.well-known/oauth-authorization-server${issuer.pathname}`, url)
  )
).json()
assert.equal(serverMetadata.issuer, issuer.href.replace(/\/$/, ""))
assert.ok(
  serverMetadata.registration_endpoint && serverMetadata.token_endpoint,
  "the authorization server must advertise registration and token endpoints"
)

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

const baseSecurityHeaders = {
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
}
for (const [name, value] of Object.entries(baseSecurityHeaders)) {
  assert.equal(rootResponse.headers.get(name), value, `root must send ${name}`)
}
assert.ok(
  rootResponse.headers.get("x-request-id"),
  "root must send a request ID"
)

if (environment === "production") {
  assert.match(
    rootResponse.headers.get("strict-transport-security") ?? "",
    /max-age=\d{7,}/,
    "production root must send HSTS"
  )

  const csp = rootResponse.headers.get("content-security-policy") ?? ""
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1]
  assert.ok(nonce, "production root must send a nonce-based CSP")
  assert.match(csp, /frame-ancestors 'none'/, "CSP must forbid framing")
  const nonceAttribute = new RegExp(
    `\\bnonce=["']${nonce.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}["']`
  )
  const inlineScripts = [...html.matchAll(/<script\b([^>]*)>/g)]
    .map((match) => match[1])
    .filter((attributes) => !/\bsrc=/.test(attributes))
  assert.ok(inlineScripts.length > 0, "root must render inline SSR scripts")
  for (const attributes of inlineScripts) {
    assert.match(
      attributes,
      nonceAttribute,
      "every inline script must carry the CSP nonce"
    )
  }
  assert.match(
    html,
    /tanbase:asset-reload/,
    "production pages must reload once when a fresh deployment's assets are not served yet"
  )

  const asset = html.match(/<script[^>]+src="(\/assets\/[^"]+\.js)"/)?.[1]
  assert.ok(asset, "root must load a fingerprinted module script")
  const assetResponse = await fetchWithTimeout(new URL(asset, url))
  assert.equal(assetResponse.status, 200, "fingerprinted asset must load")
  assert.match(
    assetResponse.headers.get("cache-control") ?? "",
    /immutable/,
    "fingerprinted assets must be cached as immutable"
  )
  assert.equal(
    assetResponse.headers.get("x-content-type-options"),
    "nosniff",
    "static assets must send nosniff"
  )
}

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

// When the environment configures a Turnstile site key, a sign-in without a
// challenge token must be rejected before any credential check runs.
if (turnstileSiteKey(environment)) {
  const challengeResponse = await fetchWithTimeout(
    new URL("/api/auth/sign-in/email", url),
    {
      method: "POST",
      headers: { "content-type": "application/json", origin: url.origin },
      body: JSON.stringify({
        email: "smoke-check@example.invalid",
        password: "smoke-check-only",
      }),
    }
  )
  assert.equal(
    challengeResponse.status,
    400,
    `sign-in without a Turnstile token must be rejected, got ${challengeResponse.status}`
  )
  assert.equal(
    (await challengeResponse.json()).code,
    "MISSING_RESPONSE",
    "sign-in must require the Turnstile challenge"
  )
}

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
