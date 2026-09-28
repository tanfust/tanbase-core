import { canonicalUrl, siteConfig } from "@/lib/site"
import type { LdJsonObject } from "@/modules/seo/head"

import { blogCopy, postImage, postPath } from "./contracts"
import type { BlogPostSummary } from "./contracts"

function publisher(): LdJsonObject {
  return {
    "@type": "Organization",
    name: siteConfig.author.name,
    url: siteConfig.author.url,
  }
}

/** One post as a schema.org `BlogPosting`. */
export function blogPostingData(
  post: BlogPostSummary,
  origin: string
): LdJsonObject {
  const url = canonicalUrl(postPath(post.slug), origin)
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Person", name: post.author },
    publisher: publisher(),
    url,
    mainEntityOfPage: url,
    image: canonicalUrl(postImage(post).path, origin),
    keywords: post.tags.join(", "),
  }
}

/** The index as a schema.org `Blog` that lists its posts. */
export function blogData(
  posts: readonly BlogPostSummary[],
  origin: string
): LdJsonObject {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: blogCopy.heading,
    description: blogCopy.description,
    url: canonicalUrl("/blog", origin),
    publisher: publisher(),
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.date,
      url: canonicalUrl(postPath(post.slug), origin),
    })),
  }
}
