import { canonicalUrl } from "@/lib/site"
import { ogImage } from "@/modules/og/cards"
import { seo } from "@/modules/seo/head"
import { requirePublicOrigin } from "@/platform/origin"

import { blogCopy, blogFeedPath, postImage, postPath } from "./contracts"
import { findPost, listPostSummaries } from "./posts.server"
import { blogData, blogPostingData } from "./structured-data"

// Each page's head is built here, on the Worker. Route heads and loaders
// load with every page, the landing page included, so the blog's head code
// stays out of the browser; the route only returns what the loader fetched.

function withFeed(head: ReturnType<typeof seo>, origin: string) {
  return {
    ...head,
    links: [
      ...head.links,
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: blogCopy.feedTitle,
        href: canonicalUrl(blogFeedPath, origin),
      },
    ],
  }
}

/** The blog index: every post's summary and the page's head tags. */
export function blogIndexPage() {
  const origin = requirePublicOrigin()
  const posts = listPostSummaries()
  const head = seo({
    title: blogCopy.title,
    description: blogCopy.description,
    path: "/blog",
    origin,
    image: ogImage("blog"),
    structuredData: blogData(posts, origin),
  })
  return { posts, head: withFeed(head, origin) }
}

/** One post and its head tags, or null when no post has the slug. */
export function blogPostPage(slug: string) {
  const post = findPost(slug)
  if (!post) return null
  const origin = requirePublicOrigin()
  const head = seo({
    title: post.title,
    description: post.description,
    path: postPath(post.slug),
    origin,
    image: postImage(post),
    structuredData: blogPostingData(post, origin),
    article: { publishedTime: post.date, author: post.author },
  })
  return { post, head: withFeed(head, origin) }
}
