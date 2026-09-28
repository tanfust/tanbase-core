import { renderHtml } from "@tanstack/markdown/html"
import { parseMarkdown } from "@tanstack/markdown/parser"

import { canonicalUrl } from "@/lib/site"

import { postCardSlug, postPath, postSlugPattern } from "./contracts"
import type { BlogPost, BlogPostSummary } from "./contracts"
import { parseFrontmatter, postFrontmatterSchema } from "./frontmatter"

// Every post in content/blog, bundled into the Worker when it is built.
// There is no database or CMS: a post ships with a deploy.
const sources = import.meta.glob<string>("/content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
})

const wordsPerMinute = 200

function slugFromPath(path: string): string {
  const slug = /\/([^/]+)\.md$/.exec(path)?.[1] ?? ""
  if (!postSlugPattern.test(slug)) {
    throw new Error(
      `${path}: name posts in lowercase words joined by hyphens, such as first-post.md`
    )
  }
  return slug
}

/**
 * Compiles one post: validates its frontmatter and renders its Markdown to
 * HTML with TanStack Markdown. Posts come only from this repository, and
 * raw HTML stays off, so the HTML holds only what Markdown can express, and
 * links and images with executable URLs are dropped.
 */
export function compilePost(path: string, source: string): BlogPost {
  const slug = slugFromPath(path)
  const document = parseMarkdown(source, {
    frontmatter: true,
    headingIds: true,
  })
  const parsed = postFrontmatterSchema.safeParse(
    parseFrontmatter(document.frontmatter ?? "")
  )
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map(
        (issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`
      )
      .join("; ")
    throw new Error(`${path}: ${problems}`)
  }
  // The page draws the title as its only h1, so the body starts at h2.
  if (
    document.children.some(
      (node) => node.type === "heading" && node.depth === 1
    )
  ) {
    throw new Error(`${path}: start headings at ##; the title is the h1`)
  }

  const words = source
    .slice(source.indexOf("---", 3) + 3)
    .split(/\s+/)
    .filter(Boolean).length
  return {
    slug,
    ...parsed.data,
    readingMinutes: Math.max(1, Math.round(words / wordsPerMinute)),
    html: renderHtml(document, {
      headingAnchors: {
        content: "#",
        className: "heading-anchor",
        ariaHidden: true,
        tabIndex: -1,
      },
    }),
  }
}

let compiled: BlogPost[] | undefined

/** Every post, newest first, compiled once per isolate. */
export function allPosts(): BlogPost[] {
  compiled ??= Object.entries(sources)
    .map(([path, source]) => compilePost(path, source))
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)
    )
  return compiled
}

export function listPostSummaries(): BlogPostSummary[] {
  return allPosts().map(({ html: _html, ...summary }) => summary)
}

export function findPost(slug: string): BlogPost | null {
  return allPosts().find((post) => post.slug === slug) ?? null
}

/** The blog's pages for the sitemap: the index, then each post. */
export function blogUrls(origin: string): string[] {
  return [
    canonicalUrl("/blog", origin),
    ...allPosts().map((post) => canonicalUrl(postPath(post.slug), origin)),
  ]
}

/** Each post's preview image card, keyed by its card slug. */
export function postCards(): Map<string, { title: string; tags: string[] }> {
  return new Map(
    allPosts().map((post) => [
      postCardSlug(post.slug),
      { title: post.title, tags: post.tags },
    ])
  )
}
