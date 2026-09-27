import { siteConfig } from "@/lib/site"

/** The size Open Graph and X recommend for large preview images. */
export const ogImageSize = { width: 1200, height: 630 } as const

/**
 * Every preview image the Worker renders, by slug, with its alternative
 * text. What each card draws lives in `content.server.ts`, so route heads that
 * name an image never load the homepage copy.
 */
export const ogCards = {
  home: {
    alt: `${siteConfig.name}: A task board that proves the whole stack works.`,
  },
} as const satisfies Record<string, { alt: string }>

export type OgCardSlug = keyof typeof ogCards

/** A card as a page names it in `seo()`. */
export interface PageImage {
  path: string
  alt: string
  width: number
  height: number
}

/** The image's path on the deployment's origin. */
export function ogImagePath(slug: OgCardSlug): string {
  return `/og/${slug}.png`
}

/** The preview image a page passes to `seo({ image })`. */
export function ogImage(slug: OgCardSlug): PageImage {
  return { path: ogImagePath(slug), alt: ogCards[slug].alt, ...ogImageSize }
}
