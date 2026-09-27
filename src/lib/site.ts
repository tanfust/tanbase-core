export const siteConfig = {
  name: "TanBase Core",
  tagline: "TanStack Start on Cloudflare Workers",
  description:
    "An open-source TanStack Start application foundation for Cloudflare Workers.",
  // The TanBase demo's own origin: the default target of
  // `pnpm smoke --environment production`. Pages, feeds, and auth use the
  // deployment's runtime origin instead; see src/platform/origin.ts.
  origin: "https://core.tanbase.dev",
  sourceRepository: "https://github.com/tanfust/tanbase-core",
  author: { name: "Tanfust", url: "https://github.com/tanfust" },
} as const

/** An absolute URL on the given public origin. */
export function canonicalUrl(path: string, origin: string): string {
  return new URL(path, `${origin}/`).toString()
}

/** A file in the source repository's default branch, such as a guide. */
export function sourceFileUrl(path: string): string {
  return `${siteConfig.sourceRepository}/blob/main/${path}`
}
