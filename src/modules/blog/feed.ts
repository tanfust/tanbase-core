import { canonicalUrl, siteConfig } from "@/lib/site"
import { escapeXml } from "@/modules/seo/discovery"

import { blogCopy, blogFeedPath, postPath } from "./contracts"
import type { BlogPostSummary } from "./contracts"

function rfc822(date: string): string {
  return new Date(`${date}T00:00:00Z`).toUTCString()
}

/** An RSS 2.0 feed of the posts, newest first, on the given origin. */
export function createRssXml(
  posts: readonly BlogPostSummary[],
  origin: string
): string {
  const items = posts.map((post) => {
    const url = canonicalUrl(postPath(post.slug), origin)
    return [
      "    <item>",
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${rfc822(post.date)}</pubDate>`,
      `      <description>${escapeXml(post.description)}</description>`,
      ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
      "    </item>",
    ].join("\n")
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(blogCopy.feedTitle)}</title>`,
    `    <link>${escapeXml(canonicalUrl("/blog", origin))}</link>`,
    `    <description>${escapeXml(blogCopy.description)}</description>`,
    "    <language>en</language>",
    `    <atom:link href="${escapeXml(canonicalUrl(blogFeedPath, origin))}" rel="self" type="application/rss+xml"/>`,
    ...(posts[0]
      ? [`    <lastBuildDate>${rfc822(posts[0].date)}</lastBuildDate>`]
      : []),
    `    <copyright>${escapeXml(siteConfig.author.name)}</copyright>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n")
}
