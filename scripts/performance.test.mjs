import assert from "node:assert/strict"
import { test } from "node:test"

import {
  budgets,
  gzipSize,
  median,
  pageScriptUrls,
  percentile,
} from "./performance.mjs"

test("page scripts include module scripts, preloads, and bootstrap imports once", () => {
  const html = `<!DOCTYPE html><html><head>
    <link rel="modulepreload" href="/assets/index-a.js" nonce="n"/>
    <link rel="modulepreload" href="/assets/button-b.js"/>
    <link rel="stylesheet" href="/assets/styles.css"/>
    <link rel="preload" href="/assets/font.woff2" as="font"/>
    </head><body>
    <script type="module" src="/assets/index-a.js"></script>
    <script nonce="n">import("/assets/routes-c.js")</script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
    </body></html>`

  assert.deepEqual(pageScriptUrls(html, "https://example.com/"), [
    "https://example.com/assets/index-a.js",
    "https://example.com/assets/button-b.js",
    "https://example.com/assets/routes-c.js",
  ])
})

test("gzip size is the compressed size", () => {
  const repetitive = new TextEncoder().encode("a".repeat(10_000))
  assert.ok(gzipSize(repetitive) < 200)
})

test("percentiles use the nearest rank", () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 0.75), 4)
  assert.equal(percentile([10], 0.75), 10)
  assert.equal(median([93, 97, 95]), 95)
  assert.throws(() => percentile([], 0.5))
})

test("budgets match the documented targets", () => {
  assert.equal(budgets.landingJavaScriptBytes, 160 * 1024)
  assert.equal(budgets.lighthouseProduction, 95)
  assert.equal(budgets.lighthouseAlarm, 90)
  assert.equal(budgets.ttfbP75Ms, 400)
})
