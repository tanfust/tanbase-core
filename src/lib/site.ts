export const siteConfig = {
  name: "TanBase Core",
  tagline: "TanStack Start on Cloudflare Workers",
  description:
    "An open-source TanStack Start application foundation for Cloudflare Workers.",
  origin: "https://core.tanbase.dev",
  sourceRepository: "https://github.com/tanfust/tanbase-core",
  author: { name: "Tanfust", url: "https://github.com/tanfust" },
} as const

export function canonicalUrl(path = "/"): string {
  return new URL(path, `${siteConfig.origin}/`).toString()
}

/** A file in the source repository's default branch, such as a guide. */
export function sourceFileUrl(path: string): string {
  return `${siteConfig.sourceRepository}/blob/main/${path}`
}
