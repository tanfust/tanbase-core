import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { budgets, median, option, percentile } from "./performance.mjs"

// Measures time to first byte of a public page from Tunis and the US East
// with Globalping's free probe network (https://globalping.io), which needs
// no account. A probe sends no cookies, so only public pages can be measured.
// TTFB here is what a first-time visitor waits for: DNS, TCP, TLS, and the
// server's response to the first byte.

const args = process.argv.slice(2)
const siteSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/lib/site.ts"),
  "utf8"
)
const canonicalOrigin = siteSource.match(/\borigin:\s*"([^"]+)"/)?.[1]
const target = new URL(option(args, "url") ?? canonicalOrigin)
const path = option(args, "path") ?? "/"
const rounds = Number(option(args, "rounds") ?? 5)
const api = "https://api.globalping.io/v1/measurements"

const regions = [
  { name: "Tunis", locations: [{ country: "TN", limit: 1 }] },
  {
    name: "US East",
    locations: [
      { magic: "US-VA", limit: 2 },
      { magic: "US-NY", limit: 1 },
      { magic: "US-NJ", limit: 1 },
    ],
  },
]

async function measure(locations) {
  const created = await fetch(api, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "http",
      target: target.hostname,
      locations,
      measurementOptions: {
        protocol: target.protocol === "https:" ? "HTTPS" : "HTTP",
        request: { method: "GET", path },
      },
    }),
  })
  if (created.status === 429) {
    throw new Error(
      `Globalping rate limit reached; remaining ${created.headers.get("x-ratelimit-remaining")}, resets in ${created.headers.get("x-ratelimit-reset")} s. Try fewer rounds or later.`
    )
  }
  if (!created.ok) {
    throw new Error(
      `Globalping returned HTTP ${created.status}: ${await created.text()}`
    )
  }
  const { id } = await created.json()
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const measurement = await (await fetch(`${api}/${id}`)).json()
    if (measurement.status !== "in-progress") return measurement.results
  }
  throw new Error(`Globalping measurement ${id} did not finish`)
}

function ttfb({ timings }) {
  return timings.dns + timings.tcp + timings.tls + timings.firstByte
}

console.log(`TTFB of ${new URL(path, target).href}, ${rounds} rounds`)
for (const region of regions) {
  const samples = []
  for (let round = 0; round < rounds; round++) {
    for (const { probe, result } of await measure(region.locations)) {
      if (result.status !== "finished" || !result.timings) continue
      samples.push({
        ms: ttfb(result),
        firstByte: result.timings.firstByte,
        where: `${probe.city}, ${probe.network}`,
        colo: result.headers?.["cf-ray"]?.split("-").pop(),
      })
    }
  }
  if (samples.length === 0) {
    console.log(`${region.name}: no probe answered`)
    continue
  }
  const values = samples.map((sample) => sample.ms)
  const colos = [...new Set(samples.map((sample) => sample.colo))].join(", ")
  console.log(
    `${region.name}: p50 ${median(values)} ms, p75 ${percentile(values, 0.75)} ms, server wait p75 ${percentile(
      samples.map((sample) => sample.firstByte),
      0.75
    )} ms; ${samples.length} samples through ${colos}; budget p75 ${budgets.ttfbP75Ms} ms`
  )
}
