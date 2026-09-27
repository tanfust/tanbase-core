import { gzipSync } from "node:zlib"

/**
 * The performance budgets from docs/OVERVIEW.md, which the performance
 * scripts enforce. Change both together.
 */
export const budgets = {
  /** JavaScript the landing page needs to render and hydrate, gzipped. */
  landingJavaScriptBytes: 150 * 1024,
  /**
   * Mobile performance on the canonical production URL, as PageSpeed
   * Insights reports it. The budget.
   */
  lighthouseProduction: 95,
  /**
   * The minimum for a Lighthouse run on a CI machine, against production or
   * a local build. GitHub's runners score a few points below PageSpeed
   * Insights for the same page, so this is an alarm for real regressions.
   */
  lighthouseAlarm: 90,
  /** Time to first byte, p75, from Tunis and US East. */
  ttfbP75Ms: 400,
}

/**
 * The scripts a server-rendered page loads to hydrate: module scripts,
 * module preloads, and the modules its inline bootstrap imports, as
 * absolute URLs without duplicates.
 */
export function pageScriptUrls(html, pageUrl) {
  const patterns = [
    /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g,
    /<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g,
    /\bimport\(\s*["']([^"']+\.m?js)["']\s*\)/g,
  ]
  const urls = new Set()
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      urls.add(new URL(match[1], pageUrl).href)
    }
  }
  return [...urls]
}

/** Gzipped size at the highest level, as `gzip -9` reports it. */
export function gzipSize(bytes) {
  return gzipSync(bytes, { level: 9 }).byteLength
}

/** Nearest-rank percentile of a non-empty list; `p` is between 0 and 1. */
export function percentile(values, p) {
  if (values.length === 0) throw new Error("percentile of an empty list")
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil(p * sorted.length))
  return sorted[rank - 1]
}

export function median(values) {
  return percentile(values, 0.5)
}

export function kilobytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

/** The value after `--name` in an argument list. */
export function option(args, name) {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}
