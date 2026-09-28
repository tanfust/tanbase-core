import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import http from "node:http"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"

import * as chromeLauncher from "chrome-launcher"
import lighthouse from "lighthouse"

import { budgets, median, option } from "./performance.mjs"

// Runs Lighthouse's default mobile audit several times and fails when the
// median performance score is under the minimum. `--compress` puts a Brotli
// proxy in front of `--url`, because `vite preview` serves assets
// uncompressed and Cloudflare does not. `--path` audits another page than
// the landing page, such as a blog post.

const args = process.argv.slice(2)
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const siteSource = readFileSync(join(root, "src/lib/site.ts"), "utf8")
const canonicalOrigin = siteSource.match(/\borigin:\s*"([^"]+)"/)?.[1]
const target = new URL(
  option(args, "path") ?? "/",
  option(args, "url") ?? canonicalOrigin
)
const runs = Number(option(args, "runs") ?? 3)
const compress = args.includes("--compress")
const minimum = Number(option(args, "min-score") ?? budgets.lighthouseAlarm)
const outputDir = join(root, "output/lighthouse")

/** A local proxy that compresses text responses the way Cloudflare does. */
function startCompressingProxy(upstream) {
  const server = http.createServer((request, response) => {
    const proxied = http.request(
      {
        host: upstream.hostname,
        port: upstream.port,
        path: request.url,
        method: request.method,
        headers: { ...request.headers, host: upstream.host },
      },
      (upstreamResponse) => {
        const type = upstreamResponse.headers["content-type"] ?? ""
        const compressible =
          /text|javascript|json|css|xml|svg/.test(type) &&
          !upstreamResponse.headers["content-encoding"] &&
          (request.headers["accept-encoding"] ?? "").includes("br")
        const headers = { ...upstreamResponse.headers }
        if (compressible) {
          delete headers["content-length"]
          headers["content-encoding"] = "br"
          headers.vary = "Accept-Encoding"
        }
        response.writeHead(upstreamResponse.statusCode ?? 502, headers)
        const body = compressible
          ? upstreamResponse.pipe(zlib.createBrotliCompress())
          : upstreamResponse
        body.pipe(response)
      }
    )
    proxied.on("error", () => {
      response.writeHead(502)
      response.end()
    })
    request.pipe(proxied)
  })
  return new Promise((resolve) => {
    server.listen(0, "localhost", () => resolve(server))
  })
}

const proxy = compress ? await startCompressingProxy(target) : null
const auditUrl = proxy
  ? `http://localhost:${proxy.address().port}${target.pathname}`
  : target.href

const chrome = await chromeLauncher.launch({
  chromeFlags: ["--headless=new", "--no-sandbox"],
})
const results = []
try {
  for (let run = 1; run <= runs; run++) {
    const { lhr, report } = await lighthouse(auditUrl, {
      port: chrome.port,
      output: "html",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    })
    if (lhr.runtimeError) {
      throw new Error(`Lighthouse failed: ${lhr.runtimeError.message}`)
    }
    const score = (id) => Math.round((lhr.categories[id].score ?? 0) * 100)
    const metric = (id) => lhr.audits[id].numericValue
    const result = {
      run,
      performance: score("performance"),
      accessibility: score("accessibility"),
      bestPractices: score("best-practices"),
      seo: score("seo"),
      lcpMs: Math.round(metric("largest-contentful-paint")),
      fcpMs: Math.round(metric("first-contentful-paint")),
      tbtMs: Math.round(metric("total-blocking-time")),
      serverResponseMs: Math.round(metric("server-response-time")),
      cls: Number(metric("cumulative-layout-shift").toFixed(3)),
      report,
    }
    results.push(result)
    console.log(
      `Run ${run}: performance ${result.performance}, accessibility ${result.accessibility}, best practices ${result.bestPractices}, SEO ${result.seo}; LCP ${result.lcpMs} ms, TBT ${result.tbtMs} ms, CLS ${result.cls}, server response ${result.serverResponseMs} ms`
    )
  }
} finally {
  await chrome.kill()
  proxy?.close()
}

const medianScore = median(results.map((result) => result.performance))
const medianRun =
  results.find((result) => result.performance === medianScore) ?? results[0]

mkdirSync(outputDir, { recursive: true })
writeFileSync(join(outputDir, "report.html"), medianRun.report)
writeFileSync(
  join(outputDir, "summary.json"),
  JSON.stringify(
    {
      url: target.href,
      compressed: compress,
      minimum,
      medianPerformance: medianScore,
      runs: results.map(({ report: _report, ...result }) => result),
    },
    null,
    2
  ) + "\n"
)

console.log(
  `Median mobile performance ${medianScore} for ${target.href}; minimum ${minimum}. Report: output/lighthouse/report.html`
)
if (medianScore < minimum) process.exit(1)
