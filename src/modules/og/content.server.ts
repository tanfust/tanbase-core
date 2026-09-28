import { siteConfig } from "@/lib/site"
import { postCards } from "@/modules/blog/posts.server"
import { homepage } from "@/modules/seo/homepage"

import type { OgCardSlug } from "./cards"

export interface OgCardContent {
  /** The headline, drawn large. */
  title: string
  /** Short labels drawn as chips along the bottom edge. */
  tags: readonly string[]
}

/**
 * What each card draws. The set, with the blog's posts, is fixed when the
 * Worker is built, so a request can never make it draw arbitrary text. Cards
 * carry no hostname: one cached image serves every origin the Worker answers
 * on.
 */
export const ogCardContent = {
  home: {
    title: homepage.title,
    tags: ["D1", "R2", "Durable Objects", "Queues", "Workflows", "Workers AI"],
  },
  blog: {
    title: `The ${siteConfig.name} blog`,
    tags: ["TanStack Start", "Cloudflare Workers", "Markdown"],
  },
} as const satisfies Record<OgCardSlug, OgCardContent>

const cardPath = /^\/og\/([a-z0-9-]+)\.png$/

/** The card a `/og/<slug>.png` path names, or null. */
export function ogCardForPath(pathname: string): OgCardContent | null {
  const slug = cardPath.exec(pathname)?.[1]
  if (!slug) return null
  if (Object.hasOwn(ogCardContent, slug)) {
    return ogCardContent[slug as OgCardSlug]
  }
  // A blog post's card: the posts are fixed when the Worker is built too.
  return postCards().get(slug) ?? null
}
