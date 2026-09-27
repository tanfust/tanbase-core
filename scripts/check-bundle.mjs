import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  budgets,
  gzipSize,
  kilobytes,
  option,
  pageScriptUrls,
} from "./performance.mjs"

// Measures the JavaScript the landing page needs to render and hydrate, the
// way a first-time visitor downloads it, and fails when it exceeds the
// budget. Optional code loaded after hydration, such as PostHog when an
// installation sets a key, is not part of it.

const args = process.argv.slice(2)
const siteSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/lib/site.ts"),
  "utf8"
)
const canonicalOrigin = siteSource.match(/\borigin:\s*"([^"]+)"/)?.[1]
const pageUrl = new URL("/", option(args, "url") ?? canonicalOrigin).href
const budget = budgets.landingJavaScriptBytes

async function fetchBytes(url) {
  // Uncompressed, so the size is measured the same way everywhere.
  const response = await fetch(url, {
    headers: { "Accept-Encoding": "identity" },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

const html = new TextDecoder().decode(await fetchBytes(pageUrl))
const urls = pageScriptUrls(html, pageUrl)
if (urls.length === 0) throw new Error(`${pageUrl} references no scripts`)

const files = await Promise.all(
  urls.map(async (url) => {
    const bytes = await fetchBytes(url)
    return { url, raw: bytes.byteLength, gzipped: gzipSize(bytes) }
  })
)
files.sort((a, b) => b.gzipped - a.gzipped)
const total = files.reduce((sum, file) => sum + file.gzipped, 0)

for (const file of files) {
  console.log(
    `${kilobytes(file.gzipped).padStart(9)} gzipped ${kilobytes(file.raw).padStart(9)} raw  ${new URL(file.url).pathname}`
  )
}
console.log(
  `Landing page JavaScript: ${kilobytes(total)} gzipped in ${files.length} files; budget ${kilobytes(budget)}.`
)

if (total > budget) {
  console.error(
    `Over budget by ${kilobytes(total - budget)}. Trim the page, or update the budget in docs/OVERVIEW.md and scripts/performance.mjs with the reason.`
  )
  process.exit(1)
}
