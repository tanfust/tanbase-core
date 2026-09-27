import { describe, expect, it } from "vitest"

import { ogCardForPath } from "@/modules/og/content.server"

import { formatPostDate, postImage } from "./contracts"
import { createRssXml } from "./feed"
import { parseFrontmatter, postFrontmatterSchema } from "./frontmatter"
import { blogIndexPage, blogPostPage } from "./pages.server"
import {
  allPosts,
  blogUrls,
  compilePost,
  findPost,
  listPostSummaries,
} from "./posts.server"

const origin = "http://localhost:3000"

function post(frontmatter: string, body = "Some words.") {
  return `---\n${frontmatter}\n---\n\n${body}\n`
}

const validFrontmatter = [
  "title: A post",
  "description: What the post says.",
  "date: 2026-09-01",
  "author: Someone",
  "tags: [one, two]",
].join("\n")

describe("frontmatter", () => {
  it("reads values, quoted values, and both list forms", () => {
    expect(
      parseFrontmatter(
        [
          "title: Hello: world",
          'author: "Quoted Name"',
          "tags: [a, 'b', c]",
          "# a comment",
          "more:",
          "  - x",
          "  - y",
        ].join("\n")
      )
    ).toEqual({
      title: "Hello: world",
      author: "Quoted Name",
      tags: ["a", "b", "c"],
      more: ["x", "y"],
    })
  })

  it("rejects lines it cannot read and repeated keys", () => {
    expect(() => parseFrontmatter("just text")).toThrow("Unreadable")
    expect(() => parseFrontmatter("a: 1\na: 2")).toThrow("Duplicate key")
    expect(() => parseFrontmatter("- orphan")).toThrow("needs a key")
  })

  it("requires every field, a real date, and slug-like tags", () => {
    const valid = parseFrontmatter(validFrontmatter)
    expect(postFrontmatterSchema.parse(valid)).toMatchObject({
      date: "2026-09-01",
      tags: ["one", "two"],
    })
    expect(
      postFrontmatterSchema.safeParse({ ...valid, date: "2026-02-30" }).success
    ).toBe(false)
    expect(
      postFrontmatterSchema.safeParse({ ...valid, tags: ["Not A Slug"] })
        .success
    ).toBe(false)
    expect(
      postFrontmatterSchema.safeParse({ ...valid, draft: "yes" }).success
    ).toBe(false)
  })
})

describe("compilePost", () => {
  it("renders Markdown to HTML without raw HTML or executable links", () => {
    const compiled = compilePost(
      "/content/blog/a-post.md",
      post(
        validFrontmatter,
        [
          "Intro <script>alert(1)</script> [bad](javascript:alert(1)).",
          "",
          "## A section",
          "",
          "- one",
        ].join("\n")
      )
    )
    expect(compiled.slug).toBe("a-post")
    expect(compiled.html).toContain("&lt;script&gt;")
    expect(compiled.html).not.toContain("<script")
    expect(compiled.html).not.toContain("javascript:")
    expect(compiled.html).toContain('<h2 id="a-section">')
    expect(compiled.html).toContain('class="heading-anchor"')
    expect(compiled.readingMinutes).toBe(1)
  })

  it("names the file and the problem when a post is wrong", () => {
    expect(() =>
      compilePost("/content/blog/a-post.md", post("title: Only a title"))
    ).toThrow(/a-post\.md: description/)
    expect(() =>
      compilePost(
        "/content/blog/a-post.md",
        post(validFrontmatter, "# A second title")
      )
    ).toThrow("start headings at ##")
    expect(() =>
      compilePost("/content/blog/Bad Name.md", post(validFrontmatter))
    ).toThrow("lowercase words")
  })
})

describe("the posts in content/blog", () => {
  it("all compile, newest first, and include the first post", () => {
    const posts = allPosts()
    expect(posts.length).toBeGreaterThan(0)
    const dates = posts.map((entry) => entry.date)
    expect(dates).toEqual([...dates].sort().reverse())

    const first = findPost("why-tanbase-core")
    expect(first).toMatchObject({
      title: "Why TanBase Core",
      author: "Tanfust",
    })
    expect(first?.html).toContain("<h2")
    expect(findPost("no-such-post")).toBeNull()
    expect(listPostSummaries()[0]).not.toHaveProperty("html")
  })
})

describe("the blog's discovery surfaces", () => {
  it("lists the index and every post in the sitemap", () => {
    const urls = blogUrls(origin)
    expect(urls[0]).toBe(`${origin}/blog`)
    expect(urls).toContain(`${origin}/blog/why-tanbase-core`)
    expect(urls).toHaveLength(allPosts().length + 1)
  })

  it("publishes an RSS feed with absolute links", () => {
    const xml = createRssXml(
      [
        {
          slug: "a-post",
          title: "Tom & Jerry <3",
          description: "Escaped",
          date: "2026-09-01",
          author: "Someone",
          tags: ["one"],
          readingMinutes: 1,
        },
      ],
      origin
    )
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain("<title>Tom &amp; Jerry &lt;3</title>")
    expect(xml).toContain(`<link>${origin}/blog/a-post</link>`)
    expect(xml).toContain("<pubDate>Tue, 01 Sep 2026 00:00:00 GMT</pubDate>")
    expect(xml).toContain(`href="${origin}/blog/rss.xml" rel="self"`)
  })

  it("gives each post indexable article tags, JSON-LD, and a preview card", () => {
    const page = blogPostPage("why-tanbase-core")
    expect(page).not.toBeNull()
    const meta = page!.head.meta as Array<Record<string, string>>
    const content = (key: string) =>
      meta.find((tag) => tag.property === key || tag.name === key)?.content
    expect(content("og:type")).toBe("article")
    expect(content("robots")).toBe("index, follow")
    expect(content("article:published_time")).toBe(page!.post.date)
    expect(content("og:image")).toBe(`${origin}/og/blog-why-tanbase-core.png`)
    expect(page!.head.links).toEqual([
      { rel: "canonical", href: `${origin}/blog/why-tanbase-core` },
      expect.objectContaining({
        rel: "alternate",
        type: "application/rss+xml",
        href: `${origin}/blog/rss.xml`,
      }),
    ])
    const jsonLd = JSON.parse(page!.head.scripts[0].children)
    expect(jsonLd).toMatchObject({
      "@type": "BlogPosting",
      headline: "Why TanBase Core",
      datePublished: page!.post.date,
    })
    expect(blogPostPage("no-such-post")).toBeNull()

    expect(ogCardForPath(postImage(page!.post).path)).toEqual({
      title: page!.post.title,
      tags: page!.post.tags,
    })
    expect(ogCardForPath("/og/blog-no-such-post.png")).toBeNull()
  })

  it("describes the index as a Blog that lists its posts", () => {
    const { posts, head } = blogIndexPage()
    expect(posts).toEqual(listPostSummaries())
    expect(head.links[0]).toEqual({ rel: "canonical", href: `${origin}/blog` })
    const jsonLd = JSON.parse(head.scripts[0].children)
    expect(jsonLd["@type"]).toBe("Blog")
    expect(jsonLd.blogPost).toHaveLength(posts.length)
  })

  it("formats a publication day in UTC", () => {
    expect(formatPostDate("2026-09-27")).toBe("September 27, 2026")
  })
})
