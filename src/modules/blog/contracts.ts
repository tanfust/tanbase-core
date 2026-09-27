import { siteConfig } from "@/lib/site"
import { ogImageSize } from "@/modules/og/cards"
import type { PageImage } from "@/modules/og/cards"

/** A post's slug: its file name in content/blog, without `.md`. */
export const postSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const blogCopy = {
  title: "Blog",
  heading: `The ${siteConfig.name} blog`,
  description: `Notes on building ${siteConfig.name}: TanStack Start on Cloudflare Workers, one feature and one primitive at a time.`,
  feedTitle: `${siteConfig.name} blog`,
}

export const blogFeedPath = "/blog/rss.xml"

/** A post as the blog index and the feed list it. */
export interface BlogPostSummary {
  slug: string
  title: string
  description: string
  /** The publication day, as YYYY-MM-DD. */
  date: string
  author: string
  tags: string[]
  readingMinutes: number
}

/** A post with its body, rendered to HTML on the Worker. */
export interface BlogPost extends BlogPostSummary {
  html: string
}

export function postPath(slug: string): string {
  return `/blog/${slug}`
}

/** The preview image card for a post, which the og module draws. */
export function postCardSlug(slug: string): string {
  return `blog-${slug}`
}

export function postImage(post: Pick<BlogPostSummary, "slug" | "title">) {
  return {
    path: `/og/${postCardSlug(post.slug)}.png`,
    alt: post.title,
    ...ogImageSize,
  } satisfies PageImage
}

/** A publication day as readers see it, such as "September 27, 2026". */
export function formatPostDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}
