import assert from "node:assert/strict"
import { createHash } from "node:crypto"
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
// The app's machine name, from siteConfig.id.
const appId = siteSource.match(/\bid:\s*"([^"]+)"/)?.[1]

assert.ok(canonicalOrigin, "src/lib/site.ts must define siteConfig.origin")
assert.ok(appId, "src/lib/site.ts must define siteConfig.id")

const environment = option("environment")
// Production defaults to the canonical origin; local runs must name their URL.
const baseUrl =
  option("url") ?? (environment === "production" ? canonicalOrigin : undefined)
// Comma-separated Worker version IDs, one of which the target must serve.
const expectedVersions = option("expect-version")?.split(",") ?? null
// Exit status while the edge still serves another version, so the
// post-deploy runner can keep waiting instead of reporting a failure.
const notYetServedStatus = 3
const allowedEnvironments = new Set(["local", "production"])
// The wrangler.jsonc section the target was deployed from: `default` is the
// top level, which the Deploy to Cloudflare button and `pnpm run deploy`
// use. It defaults to the section named like the environment.
const configSection = option("config") ?? environment
const allowedSections = new Set(["default", "local", "production"])

if (
  !baseUrl ||
  !environment ||
  !allowedEnvironments.has(environment) ||
  !allowedSections.has(configSection)
) {
  console.error(
    "Usage: pnpm smoke -- [--url <url>] --environment <local|production> [--config <default|local|production>] [--expect-version <id,...>]\n--url is required for local and defaults to the canonical origin for production. Use --config default for a deployment of the top-level configuration, such as one made with the Deploy to Cloudflare button."
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
  return (name === "default" ? config : config.env?.[name]) ?? {}
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
  environmentConfig(configSection).version_metadata
    ? typeof health.version === "string" && health.version.length > 0
    : health.version === null,
  "health endpoint must report the running Worker version"
)
assert.deepEqual(health, {
  status: "ok",
  service: appId,
  environment,
  version: health.version,
  checks: {
    database: "ok",
    files: environmentConfig(configSection).r2_buckets?.some(
      (bucket) => bucket.binding === "FILES"
    )
      ? "ok"
      : "disabled",
    realtime: environmentConfig(configSection).durable_objects?.bindings?.some(
      (binding) => binding.name === "BOARD"
    )
      ? "ok"
      : "disabled",
  },
})

// MCP: an unauthenticated call is challenged toward the OAuth discovery chain
// that MCP clients such as Claude follow. Identifiers derive from the
// configured auth URL; documents are fetched from the target under test.
// The deployment's public origin: BETTER_AUTH_URL when the environment pins
// one, otherwise the origin under test, as the Worker itself resolves it.
const publicOrigin = new URL(
  environmentConfig(configSection).vars?.BETTER_AUTH_URL || url.origin
).origin
const authOrigin = new URL(publicOrigin)
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
assert.match(
  html,
  /<title>TanBase Core\b[^<]*<\/title>/i,
  "head content must render"
)
assert.deepEqual(
  [...html.matchAll(/<link[^>]+rel="canonical"[^>]*>/gi)].map(
    ([tag]) => tag.match(/href="([^"]+)"/)?.[1]
  ),
  [`${publicOrigin}/`],
  "root must identify exactly one canonical production URL"
)
assert.match(
  html,
  /<meta[^>]+name="robots"[^>]+content="index, follow"[^>]*>/i,
  "root must allow indexing"
)
const structuredData = [
  ...html.matchAll(
    /<script[^>]+type="application\/ld\+json"[^>]*>([^<]*)<\/script>/gi
  ),
].map(([, json]) => JSON.parse(json))
assert.deepEqual(
  structuredData.map((entry) => entry["@type"]),
  ["SoftwareSourceCode"],
  "root must describe the repository as SoftwareSourceCode JSON-LD"
)
assert.equal(
  structuredData[0].url,
  `${publicOrigin}/`,
  "JSON-LD must name the canonical production URL"
)
assert.match(
  html,
  new RegExp(
    `<meta[^>]+property="og:url"[^>]+content="${publicOrigin}/"[^>]*>`,
    "i"
  ),
  "root must expose the canonical Open Graph URL"
)
assert.equal(
  /<meta[^>]+property="og:image"[^>]+content="([^"]+)"[^>]*>/i.exec(html)?.[1],
  `${publicOrigin}/og/home.png`,
  "root must name its preview image on the public origin"
)
assert.match(
  html,
  /<meta[^>]+name="twitter:card"[^>]+content="summary_large_image"[^>]*>/i,
  "root must ask for a large preview card"
)
assert.match(
  html,
  /<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/i,
  "root must link the web app manifest"
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
    new RegExp(`${appId}:asset-reload`),
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

// The Worker draws the preview image; after a deploy this request fills the
// cache. Unknown cards are never drawn.
const imageResponse = await fetchWithTimeout(new URL("/og/home.png", url))
const image = new DataView(await imageResponse.arrayBuffer())

assert.equal(imageResponse.status, 200, "preview image must return HTTP 200")
assert.equal(
  imageResponse.headers.get("content-type"),
  "image/png",
  "preview image must be a PNG"
)
assert.equal(
  imageResponse.headers.get("cache-control"),
  "public, max-age=86400",
  "preview image must use its cache policy"
)
assert.deepEqual(
  [image.getUint32(0), image.getUint32(4)],
  [0x89504e47, 0x0d0a1a0a],
  "preview image must carry the PNG signature"
)
assert.deepEqual(
  [image.getUint32(16), image.getUint32(20)],
  [1200, 630],
  "preview image must be 1200 by 630"
)
assert.equal(
  (await fetchWithTimeout(new URL("/og/missing.png", url))).status,
  404,
  "unknown preview images must return HTTP 404"
)

// The manifest names the app and its icons, which static assets serve.
const manifestResponse = await fetchWithTimeout(
  new URL("/manifest.webmanifest", url)
)
assert.equal(manifestResponse.status, 200, "manifest must return HTTP 200")
assert.equal(
  manifestResponse.headers.get("content-type"),
  "application/manifest+json",
  "manifest must use its media type"
)
const manifest = await manifestResponse.json()
assert.ok(manifest.name && manifest.short_name, "manifest must name the app")
for (const icon of manifest.icons ?? []) {
  const iconResponse = await fetchWithTimeout(new URL(icon.src, url))
  assert.equal(iconResponse.status, 200, `manifest icon ${icon.src} must exist`)
  await iconResponse.arrayBuffer()
}

// Only the homepage is indexable: other pages opt out and name no canonical URL.
const loginResponse = await fetchWithTimeout(new URL("/login", url))
const loginHtml = await loginResponse.text()

assert.equal(loginResponse.status, 200, "login page must return HTTP 200")
assert.match(
  loginHtml,
  /<meta[^>]+name="robots"[^>]+content="noindex"[^>]*>/i,
  "login page must be marked noindex"
)
assert.doesNotMatch(
  loginHtml,
  /<link[^>]+rel="canonical"/i,
  "noindex pages must not name a canonical URL"
)

// When the environment configures a Turnstile site key, a sign-in without a
// challenge token must be rejected before any credential check runs.
if (turnstileSiteKey(configSection)) {
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
    `<${publicOrigin}/llms.txt>; rel="describedby"; type="text/markdown"`
  ),
  "root must advertise llms.txt"
)
assert.ok(
  rootLinks.includes(
    `<${publicOrigin}/sitemap.xml>; rel="related"; type="application/xml"`
  ),
  "root must advertise sitemap.xml"
)
assert.ok(
  rootLinks.includes(
    `<${publicOrigin}/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`
  ),
  "root must advertise the API catalog"
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
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => match[1]
)
assert.deepEqual(
  sitemapUrls.slice(0, 2),
  [`${publicOrigin}/`, `${publicOrigin}/blog`],
  "sitemap must list the canonical homepage, then the blog"
)
const postUrls = sitemapUrls.slice(2)
assert.ok(postUrls.length > 0, "sitemap must list the blog's posts")
for (const postUrl of postUrls) {
  assert.match(
    postUrl,
    new RegExp(`^${publicOrigin.replaceAll(".", "\\.")}/blog/[a-z0-9-]+$`),
    "sitemap must list nothing but the homepage, the blog, and its posts"
  )
}

// The blog: an indexable index, server-rendered posts, and an RSS feed.
const blogResponse = await fetchWithTimeout(new URL("/blog", url))
const blogHtml = await blogResponse.text()
assert.equal(blogResponse.status, 200, "/blog must return HTTP 200")
assert.ok(
  blogHtml.includes(`<link rel="canonical" href="${publicOrigin}/blog"`),
  "/blog must name its canonical URL"
)
assert.ok(
  blogHtml.includes('<meta name="robots" content="index, follow"'),
  "/blog must be indexable"
)

const postPath = new URL(postUrls[0]).pathname
const postResponse = await fetchWithTimeout(new URL(postPath, url))
const postHtml = await postResponse.text()
assert.equal(postResponse.status, 200, `${postPath} must return HTTP 200`)
assert.ok(
  postHtml.includes('<meta property="og:type" content="article"'),
  `${postPath} must be an Open Graph article`
)
assert.ok(
  postHtml.includes('"@type":"BlogPosting"'),
  `${postPath} must carry BlogPosting JSON-LD`
)
assert.match(
  postHtml,
  /<article[\s\S]*<h2 id="/,
  `${postPath} must be rendered on the server`
)
const postImagePath = `/og/blog-${postPath.split("/").pop()}.png`
assert.ok(
  postHtml.includes(`content="${publicOrigin}${postImagePath}"`),
  `${postPath} must name its preview image`
)
const postImageResponse = await fetchWithTimeout(new URL(postImagePath, url))
await postImageResponse.arrayBuffer()
assert.equal(postImageResponse.status, 200, `${postImagePath} must be drawn`)
assert.equal(
  postImageResponse.headers.get("content-type"),
  "image/png",
  `${postImagePath} must be a PNG`
)

const feedResponse = await fetchWithTimeout(new URL("/blog/rss.xml", url))
const feed = await feedResponse.text()
assert.equal(feedResponse.status, 200, "the blog feed must return HTTP 200")
assert.match(
  feedResponse.headers.get("content-type") ?? "",
  /^application\/rss\+xml\b/,
  "the blog feed must be RSS"
)
assert.ok(
  feed.includes(`<link>${postUrls[0]}</link>`),
  "the blog feed must link its posts on the canonical origin"
)

const missingPostResponse = await fetchWithTimeout(
  new URL("/blog/no-such-post", url)
)
await missingPostResponse.arrayBuffer()
assert.equal(missingPostResponse.status, 404, "a missing post must be a 404")

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
    new RegExp(`^Sitemap: ${publicOrigin}/sitemap\\.xml$`, "m"),
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
  llms.includes(`${publicOrigin}/`),
  "llms.txt must name the canonical production origin"
)
assert.ok(
  llms.includes(`${publicOrigin}/mcp`),
  "llms.txt must name the MCP endpoint"
)
assert.ok(
  llms.includes("does not offer a public REST API"),
  "llms.txt must state the current capability boundary"
)

// Markdown negotiation: agents that ask for Markdown get the homepage as
// Markdown; everyone else keeps getting HTML.
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
  /^# \S/m,
  "negotiated Markdown must contain the page heading"
)
assert.doesNotMatch(
  markdown,
  /<html[\s>]/i,
  "negotiated Markdown must not return the HTML document"
)

// A page request that rules HTML out must not fail: a missing page is 404.
const jsonOnlyMissing = await fetchWithTimeout(
  new URL("/.well-known/smoke-missing", url),
  { headers: { Accept: "application/json" } }
)
assert.equal(
  jsonOnlyMissing.status,
  404,
  `a missing page requested as JSON must return 404, got ${jsonOnlyMissing.status}`
)

// Agent discovery documents. Identifiers derive from the configured auth
// origin; documents are fetched from the target under test.
async function discoveryDocument(path, contentType, init) {
  const response = await fetchWithTimeout(new URL(path, url), init)
  assert.equal(response.status, 200, `${path} must return HTTP 200`)
  assert.match(
    response.headers.get("content-type") ?? "",
    contentType,
    `${path} must return ${contentType}`
  )
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "*",
    `${path} must be readable from any origin`
  )
  assert.equal(
    response.headers.get("cache-control"),
    cacheControl,
    `${path} must use the discovery cache policy`
  )
  return response
}

const apiCatalog = await (
  await discoveryDocument(
    "/.well-known/api-catalog",
    /^application\/linkset\+json\b/,
    { headers: { Accept: "application/linkset+json" } }
  )
).json()
assert.equal(
  apiCatalog.linkset?.[0]?.anchor,
  mcpResource,
  "the API catalog must list the MCP endpoint"
)
const apiCatalogHead = await fetchWithTimeout(
  new URL("/.well-known/api-catalog", url),
  { method: "HEAD" }
)
assert.match(
  apiCatalogHead.headers.get("link") ?? "",
  /rel="api-catalog"/,
  "HEAD /.well-known/api-catalog must return its api-catalog link"
)

const serverCard = await (
  await discoveryDocument(
    "/mcp/server-card",
    /^application\/mcp-server-card\+json\b/
  )
).json()
assert.equal(
  serverCard.remotes?.[0]?.url,
  mcpResource,
  "the MCP server card must name the /mcp remote"
)
const legacyServerCard = await (
  await discoveryDocument(
    "/.well-known/mcp/server-card.json",
    /^application\/json\b/
  )
).json()
assert.equal(
  legacyServerCard.transport?.endpoint,
  mcpResource,
  "the draft-path server card must name the /mcp endpoint"
)

const aiCatalog = await (
  await discoveryDocument(
    "/.well-known/ai-catalog.json",
    /^application\/ai-catalog\+json\b/,
    {
      headers: { Accept: "application/ai-catalog+json" },
    }
  )
).json()
assert.ok(aiCatalog.entries?.length > 0, "the AI catalog must list entries")
for (const entry of aiCatalog.entries) {
  const target = await fetchWithTimeout(
    new URL(new URL(entry.url).pathname, url)
  )
  assert.equal(target.status, 200, `AI catalog entry ${entry.url} must resolve`)
}

const skillsIndex = await (
  await discoveryDocument(
    "/.well-known/agent-skills/index.json",
    /^application\/json\b/
  )
).json()
assert.ok(skillsIndex.skills?.length > 0, "the skills index must list skills")
for (const skill of skillsIndex.skills) {
  const artifact = await discoveryDocument(skill.url, /^text\/markdown\b/)
  const digest = createHash("sha256")
    .update(Buffer.from(await artifact.arrayBuffer()))
    .digest("hex")
  assert.equal(
    skill.digest,
    `sha256:${digest}`,
    `${skill.url} must match its indexed digest`
  )
}

console.log(`Smoke checks passed for ${environment}: ${url.origin}`)
