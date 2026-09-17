export const siteConfig = {
  name: "TanBase Core",
  description:
    "An open-source TanStack Start application foundation for Cloudflare Workers.",
  origin: "https://tanbase-core.tanfust.com",
  sourceRepository: "https://github.com/tanfust/tanbase-core",
} as const

export function canonicalUrl(path = "/"): string {
  return new URL(path, `${siteConfig.origin}/`).toString()
}
