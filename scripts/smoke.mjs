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
const signal = AbortSignal.timeout(15_000)
const healthResponse = await fetch(new URL("/api/health", url), { signal })

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

const rootResponse = await fetch(new URL("/", url), { signal })
const html = await rootResponse.text()

assert.ok(rootResponse.ok, `root must return 2xx, got ${rootResponse.status}`)
assert.match(
  rootResponse.headers.get("content-type") ?? "",
  /^text\/html\b/,
  "root must return HTML"
)
assert.match(html, /<html[\s>]/i, "root must contain a rendered document")
assert.match(html, /<title>TanBase Core<\/title>/i, "head content must render")
assert.match(html, /<script[\s>]/i, "hydration scripts must render")
assert.doesNotMatch(html, /Internal Server Error/i)

console.log(`Smoke checks passed for ${environment}: ${url.origin}`)
