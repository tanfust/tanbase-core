import { canonicalUrl, siteConfig } from "@/lib/site"

type LdJsonObject = { [key: string]: LdJsonValue }
type LdJsonValue =
  string | number | boolean | null | LdJsonObject | readonly LdJsonValue[]

interface SeoCommon {
  /** The page's own name, followed by the site name. Omit on the homepage. */
  title?: string
  description?: string
}

interface IndexablePage extends SeoCommon {
  /** Canonical path. Every page search engines may index names one. */
  path: string
  /** The deployment's public origin, from `getSiteOrigin()`. */
  origin: string
  noindex?: false
  /** A schema.org object, rendered as JSON-LD. */
  structuredData?: LdJsonObject
}

interface NoindexPage extends SeoCommon {
  /** Keeps the page out of search results; it gets no canonical URL. */
  noindex: true
  path?: never
  origin?: never
  structuredData?: never
}

export type SeoOptions = IndexablePage | NoindexPage

/**
 * The robots policy for routes that do not call `seo()`. Indexing is opt-in:
 * a page appears in search only when its route names a canonical path.
 */
export const defaultRobots = { name: "robots", content: "noindex" } as const

export function documentTitle(title?: string): string {
  return title
    ? `${title} · ${siteConfig.name}`
    : `${siteConfig.name}: ${siteConfig.tagline}`
}

/**
 * A route's head tags: title, description, robots, Open Graph, and, for
 * indexable pages, the canonical URL and optional JSON-LD. Child routes
 * override their parents' meta by name, but links are not deduplicated, so
 * only the page itself may emit a canonical link.
 */
export function seo(options: SeoOptions) {
  const title = documentTitle(options.title)
  const description = options.description ?? siteConfig.description
  const meta = [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: siteConfig.name },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    // No preview image until F-017 renders one on the Worker.
    { name: "twitter:card", content: "summary" },
  ]

  if (options.noindex) {
    return { meta: [...meta, defaultRobots], links: [], scripts: [] }
  }

  const url = canonicalUrl(options.path, options.origin)
  return {
    meta: [
      ...meta,
      { name: "robots", content: "index, follow" },
      { property: "og:url", content: url },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: options.structuredData
      ? [
          {
            type: "application/ld+json",
            children: jsonLd(options.structuredData),
          },
        ]
      : [],
  }
}

/**
 * JSON for an inline `<script>` data block. Escaping `<` keeps a string
 * value from closing the element early; JSON parsers read `\u003c` as `<`.
 */
export function jsonLd(data: LdJsonObject): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c")
}

/** The repository itself, described for search engines on the homepage. */
export function softwareSourceCode(origin: string): LdJsonObject {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: siteConfig.name,
    description: siteConfig.description,
    url: canonicalUrl("/", origin),
    codeRepository: siteConfig.sourceRepository,
    programmingLanguage: "TypeScript",
    runtimePlatform: "Cloudflare Workers",
    license: "https://spdx.org/licenses/MIT.html",
    author: {
      "@type": "Organization",
      name: siteConfig.author.name,
      url: siteConfig.author.url,
    },
  }
}
