---
status: accepted
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# ADR-0019: Blog posts are repository Markdown rendered on the Worker

## Context

F-031 adds a public blog at `/blog` and `/blog/$slug`, written with TanStack
Markdown. It must be server-rendered, fast, and within the budgets in
[Performance](../PERFORMANCE.md), wired into the seo and og modules, and
removable.

Constraints:

- **No database or CMS.** Posts are files in the repository, so they are
  reviewed in pull requests and ship with a deploy.
- **The JavaScript budget.** Public pages load the same entry as the landing
  page, which sits within about 1 KB of its 160 KB budget. TanStack
  Markdown's React renderer, parser included, is about 7.5 KB gzipped.
- **Route options load everywhere.** A route's `head` and `loader` ship with
  the first page of every visit; only components are split per route.
- **Trust.** The content is written by the repository's contributors, not by
  visitors.

## Decision

- **Posts live in `content/blog/`,** one Markdown file per post with
  frontmatter: `title`, `description`, `date`, `author`, and `tags`. The
  file name is the slug. `import.meta.glob` bundles them into the Worker at
  build time, in `src/modules/blog/posts.server.ts`.
- **A test compiles every post.** A Zod schema checks the frontmatter, which
  a small parser reads, since TanStack Markdown leaves it as text. A post with
  a wrong field, a level-1 heading, or a bad file name fails CI with the file
  and the problem, instead of failing the Worker.
- **The Worker renders HTML.** `parseMarkdown()` and `renderHtml()` from
  `@tanstack/markdown` 0.0.15 compile each post once per isolate, with heading
  IDs and anchors. The page inserts that HTML, so the browser loads no
  Markdown code. Raw HTML stays off, and TanStack Markdown drops links and
  images with executable URLs.
- **The Worker builds the head tags.** The blog's server functions return
  the post and its `seo()` tags, with `BlogPosting` or `Blog` JSON-LD and an
  RSS alternate link; the routes return what their loaders fetched.
- **Posts are indexable.** Each has a canonical URL, `og:type` article, a
  sitemap entry, and its own preview image, which the og module draws from the
  post's title and tags. `/blog/rss.xml` is an RSS 2.0 feed.

## Consequences

- Blog pages load 156 KB of JavaScript, less than the landing page, and a
  post's text is in the first response.
- The set of preview images is still fixed when the Worker is built, so a
  request cannot make it draw arbitrary text
  ([ADR-0018](0018-preview-images-on-the-worker.md)).
- A new post needs a pull request and a deploy; there is no draft or
  scheduling workflow.
- TanStack Markdown supports a documented blog and docs profile, not all of
  CommonMark or GFM, and is pre-1.0. The version is pinned; the post tests
  catch a change in how existing posts parse.
- Replacing components inside a post, such as links, would need the React
  renderer, and its cost on every post.
- The og module reads the blog's posts for their cards, and the blog names
  og images, so removing either module edits the other
  ([module removal](../MODULE_REMOVAL.md#blog)).

## Alternatives

- **Render with `<Markdown>` in React.** TanStack Markdown's React guide
  recommends it over inserting HTML, for component replacement and to avoid a
  trusted-HTML boundary. It would cost about 7.5 KB on every post and parse
  in the browser. The content is trusted and needs no replacements, so the
  HTML renderer was chosen.
- **A D1 table or a CMS.** Rejected by the feature: posts belong in the
  repository.
- **Prerendered static files.** TanStack Start can prerender, but the Worker
  already server-renders every page, and one render path keeps the head tags,
  preview images, and sitemap consistent.
