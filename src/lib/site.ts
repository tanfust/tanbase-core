export interface SiteLogo {
  /**
   * An image in `public/`, such as `/logo.svg`. An SVG also appears in link
   * preview images; other formats appear only in the app.
   */
  src: string
  /**
   * A one-color mark. The app draws it in the theme's colors instead of its
   * own, so a black mark still shows in dark mode.
   */
  monochrome: boolean
}

export interface SiteConfig {
  /** The full product name, in titles, emails, and the header. */
  name: string
  /** The name in running text, such as "New to TanBase?". */
  shortName: string
  /** The homepage title after the name. */
  tagline: string
  /** The line under the name in the header and preview image. */
  subtitle: string
  /** The default page description, for search and link previews. */
  description: string
  /**
   * A lowercase machine name, with letters, digits, and dashes: the MCP
   * server name, the health check's `service`, the agent skill's name, and
   * browser storage keys.
   */
  id: string
  /** The brand mark. Without one, the header shows a check-square icon. */
  logo: SiteLogo | null
  /** Icons in `public/`, for browsers, home screens, and the web manifest. */
  icons: {
    favicon: string
    /** A 96 by 96 PNG. */
    png: string
    /** A 180 by 180 PNG for iOS home screens. */
    appleTouch: string
    /** 192 by 192 and 512 by 512 PNGs for the web manifest. */
    manifest: readonly [string, string]
  }
  /** The browser UI color, and the web manifest's theme color. */
  themeColor: string
  /**
   * The canonical demo's origin: the default target of
   * `pnpm smoke --environment production`. Pages, feeds, and auth use the
   * deployment's runtime origin instead; see src/platform/origin.ts.
   */
  origin: string
  sourceRepository: string
  author: { name: string; url: string }
}

/**
 * The app's identity. Make the app yours here: pages, emails, preview
 * images, the web manifest, and the MCP server and agent documents read
 * these values. See "Make it yours" in the README.
 */
export const siteConfig: SiteConfig = {
  name: "TanBase Core",
  shortName: "TanBase",
  tagline: "TanStack Start on Cloudflare Workers",
  subtitle: "Tasks on Cloudflare",
  description:
    "An open-source TanStack Start application foundation for Cloudflare Workers.",
  id: "tanbase-core",
  logo: { src: "/logo.svg", monochrome: true },
  icons: {
    favicon: "/favicon.ico",
    png: "/icon.png",
    appleTouch: "/apple-icon.png",
    manifest: [
      "/web-app-manifest-192x192.png",
      "/web-app-manifest-512x512.png",
    ],
  },
  themeColor: "#1447e6",
  origin: "https://core.tanbase.dev",
  sourceRepository: "https://github.com/tanfust/tanbase-core",
  author: { name: "Tanfust", url: "https://github.com/tanfust" },
}

/** An absolute URL on the given public origin. */
export function canonicalUrl(path: string, origin: string): string {
  return new URL(path, `${origin}/`).toString()
}

/** A file in the source repository's default branch, such as a guide. */
export function sourceFileUrl(path: string): string {
  return `${siteConfig.sourceRepository}/blob/main/${path}`
}

/**
 * Fills a served text template, such as `llms.txt` or a SKILL.md, with this
 * app's identity and a deployment's origin: `{{name}}`, `{{id}}`,
 * `{{repository}}`, `{{origin}}`, and `{{host}}`.
 */
export function fillTemplate(template: string, origin: string): string {
  return template
    .replaceAll("{{name}}", siteConfig.name)
    .replaceAll("{{id}}", siteConfig.id)
    .replaceAll("{{repository}}", siteConfig.sourceRepository)
    .replaceAll("{{origin}}", origin)
    .replaceAll("{{host}}", new URL(origin).host)
}

/** The folder `git clone` creates for the source repository. */
export function repositoryFolder(): string {
  return new URL(siteConfig.sourceRepository).pathname.split("/").pop() ?? ""
}
