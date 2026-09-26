import { contentSignal, discoveryCacheControl } from "./discovery"
import { createHomepageMarkdown } from "./homepage"

interface MediaRange {
  range: string
  quality: number
}

function mediaRanges(accept: string): MediaRange[] {
  return accept.split(",").map((part) => {
    const [range = "", ...parameters] = part
      .split(";")
      .map((value) => value.trim().toLowerCase())
    const q = parameters.find((parameter) => parameter.startsWith("q="))
    const quality = q === undefined ? 1 : Number(q.slice(2))
    return { range, quality: Number.isFinite(quality) ? quality : 0 }
  })
}

function explicitQuality(ranges: MediaRange[], type: string): number {
  return Math.max(
    0,
    ...ranges
      .filter(({ range }) => range === type)
      .map(({ quality }) => quality)
  )
}

/**
 * True when the client names `text/markdown` at least as highly as
 * `text/html`. Browsers never name Markdown, so they keep getting HTML.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false
  const ranges = mediaRanges(accept)
  const markdown = explicitQuality(ranges, "text/markdown")
  return markdown > 0 && markdown >= explicitQuality(ranges, "text/html")
}

/**
 * TanStack Start answers a page request with a 500 unless one Accept entry
 * starts with `*\/*` or `text/html`. This mirrors that check.
 */
function startRendersFor(accept: string | null): boolean {
  if (!accept) return true
  return accept
    .split(",")
    .some((part) => /^(\*\/\*|text\/html)/.test(part.trim().toLowerCase()))
}

// Server functions and API routes negotiate their own formats.
function isPageRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false
  const { pathname } = new URL(request.url)
  return !pathname.startsWith("/api/") && !pathname.startsWith("/_serverFn/")
}

/**
 * Pages have one representation besides Markdown: HTML. A page request that
 * rules HTML out gets it anyway (RFC 9110 lets a server disregard Accept), so
 * a missing page is a 404 and a real one renders, instead of a 500.
 */
export function asPageRequest(request: Request): Request {
  const accept = request.headers.get("Accept")
  if (!isPageRequest(request) || startRendersFor(accept)) return request
  const headers = new Headers(request.headers)
  headers.set("Accept", "text/html")
  return new Request(request, { headers })
}

/** Pages with a Markdown representation, by path. */
const markdownPages = new Map<string, () => string>([
  ["/", createHomepageMarkdown],
])

/** A rough count for `x-markdown-tokens`: about four characters a token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** The Markdown representation of a page when the client prefers it. */
export function markdownPageResponse(request: Request): Response | null {
  if (!isPageRequest(request)) return null
  if (!prefersMarkdown(request.headers.get("Accept"))) return null
  const render = markdownPages.get(new URL(request.url).pathname)
  if (!render) return null

  const markdown = render()
  return new Response(request.method === "HEAD" ? null : markdown, {
    headers: {
      "Cache-Control": discoveryCacheControl,
      "Content-Signal": contentSignal,
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "x-markdown-tokens": String(estimateTokens(markdown)),
    },
  })
}

/** Whether a path's response depends on the Accept header. */
export function hasMarkdownRepresentation(pathname: string): boolean {
  return markdownPages.has(pathname)
}
