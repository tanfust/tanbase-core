import { siteConfig } from "@/lib/site"

/** The web app manifest, so browsers can install the app with its icons. */
export function webManifest() {
  const [small, large] = siteConfig.icons.manifest
  return {
    id: "/app",
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: "/app",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: siteConfig.themeColor,
    icons: [
      { src: small, sizes: "192x192", type: "image/png" },
      { src: large, sizes: "512x512", type: "image/png" },
    ],
  }
}
