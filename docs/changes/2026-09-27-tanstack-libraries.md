---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: TanStack Form, Table, Charts, and Markdown

## Summary

Four more TanStack libraries entered the app, each with a feature that uses
it, tests, and docs, the way a Cloudflare primitive does:

- **F-028, TanStack Form:** every form, validated with the server's Zod
  schemas.
- **F-029, TanStack Table:** a list view of a project's tasks whose sort,
  filters, search, and columns live in the URL.
- **F-030, TanStack Charts:** a stats view of weekly activity and the status
  mix. recharts is gone.
- **F-031, TanStack Markdown:** a public blog at `/blog`, from Markdown in
  `content/blog`, with its first post, "Why TanBase Core"
  ([ADR-0019](../decisions/0019-blog-from-repository-markdown.md)).

TanStack DB and TanStack AI are recorded as deferred candidates, F-032 and
F-033.

## Motivation

The app already rested on TanStack Start, Router, and Query. The rest of the
ecosystem was either unused or, like the shadcn/ui chart component, installed
but unused. The goal was to bring more of it in under the repository's rule:
no demo-only code.

## Behavior and configuration changes

- **Forms (F-028):**
  - `src/components/form.tsx` binds `useAppForm()` with `createFormHook`:
    `TextField` and `TextareaField` render the shadcn/ui `Field` markup with
    `aria-invalid` and an error linked through `aria-describedby`, and
    `SubmitButton` shows the pending label. `validateOnSubmit` is
    `revalidateLogic()`: validation on the first submit, then on every change.
  - Login, sign-up, forgot-password, reset-password, the settings profile and
    password forms, the task dialog, and the project dialog use it.
  - `src/modules/auth/schemas.ts` holds the auth schemas. A Better Auth
    `before` hook in `auth.server.ts` checks the same fields on sign-in,
    sign-up, reset requests, verification requests, password resets, profile
    updates, and password changes, so every client gets the same rules and
    messages.
  - `src/modules/tasks/schemas.ts`: `taskValuesSchema` is the base that
    `createTaskInputSchema` and `updateTaskInputSchema` extend, and the task
    dialog's `taskFormSchema` pipes its fields into it. The project dialog
    validates with `createProjectInputSchema` itself. The schemas now carry
    the messages the forms showed before, such as "Enter a task title."
  - Turnstile gating, redirects, OAuth continuation, and every message are
    unchanged. The inputs keep their `required`, `type`, and length
    attributes, so the browser's own checks still run first.
- **List view (F-029):**
  - `/app` has Board, List, and Stats tabs. The List tab is
    `src/components/board/task-table.tsx`, on `@tanstack/react-table` 9.2.4
    and the shadcn/ui table: sort by title, status, due date, created, or
    updated; a status filter; a search over titles and notes; hideable
    columns; the board's task menu on each row.
  - `src/modules/tasks/board-search.ts` validates the view, `q`, `status`,
    `sort`, `desc`, and `hide` with Zod Mini. A malformed param falls back to
    its default, and `stripSearchParams` keeps defaults out of links. Search
    text reaches the URL after a 250 ms pause; the table filters as someone
    types. The box stops at 100 characters, the longest search the URL keeps.
  - The table reads `boardQueryOptions()`; only a project change reloads.
- **Stats (F-030):**
  - `src/components/board/project-stats.tsx`, on `@tanstack/charts` 0.18.0,
    draws grouped bars of tasks created and completed per week over eight UTC
    weeks, and a bar per status, from `src/modules/tasks/stats.ts`. A done
    task counts as completed in the week it was last updated; the app stores
    no completion date.
  - Each chart has a descriptive `ariaLabel` and a screen-reader table of its
    numbers. The panel is lazy, so its chunk, 42.7 KB gzipped, loads only on
    the Stats view. The theme's `--chart-*` tokens color it.
  - TanStack Charts is Alpha. It could draw both charts and server-render
    them, so it was used, pinned exactly.
  - `recharts` and `src/components/ui/chart.tsx`, which nothing imported, are
    removed.
- **Blog (F-031):**
  - New `blog` module: `posts.server.ts` bundles `content/blog/*.md` with
    `import.meta.glob`, checks each post's frontmatter against a Zod schema,
    and renders it once per isolate with `@tanstack/markdown` 0.0.15;
    `pages.server.ts` builds each page's head tags on the Worker; `feed.ts`
    writes the RSS feed.
  - Routes: `/blog`, `/blog/$slug`, and `/blog/rss.xml`. A missing post is a
    `404`.
  - `seo()` takes an `article` option for `og:type` article and
    `article:published_time`. The sitemap lists the blog and its posts after
    the homepage. The og module draws a `blog` card and a `blog-<slug>` card
    per post from its title and tags. The homepage footer and `llms.txt`
    link the blog.
- **Shared:**
  - `src/lib/zod-config.ts` turns off Zod's JIT before any schema exists.
    Building an object schema would otherwise probe `eval`, which the page's
    CSP reports as a violation.
  - `vite.config.ts` pre-bundles the route-level TanStack packages, so the
    dev server never re-optimizes mid-session, reloads, and loads React
    twice.
  - `pnpm perf:bundle` and `pnpm perf:lighthouse` take `--path`. CI checks
    `/blog`'s JavaScript as well as the landing page's.
  - `pnpm smoke` checks the blog: the sitemap's entries, the index, the
    newest post and its preview image, the feed, and a `404`.
  - `pnpm test:e2e` runs one spec at a time. With four spec files in
    parallel against one cold dev server, Vite's module runner sometimes
    handed a request a module another request was still evaluating. Auth
    waits in the specs allow 15 seconds.
- **Fixes found by the browser journeys:**
  - A new task could show twice for a moment: the realtime echo, with the
    real ID, can arrive before the create response, and the board appended it
    beside the optimistic copy. The echo now takes the optimistic copy's place
    (`applyBoardEvent` in `src/modules/realtime/events.ts`), and the
    mutation's `onSuccess` leaves an already-replaced entry alone. This
    predates the change; TanStack Form's asynchronous submit made the journey
    catch it.
  - The list view's dates rendered in the Worker's UTC and the browser's
    zone, so hydration failed for timestamps whose day differs. They render in
    UTC until hydration, then in the browser's zone, with `useHydrated()`.
- **Landing JavaScript budget:** 150 KB to 160 KB. `/app`'s search schema is
  a route option, and route options load with every page, so Zod's core now
  ships with the landing page. It is shared with the browser's WebMCP tools,
  which must stay on full Zod: the MCP SDK reads each tool's JSON Schema from
  it, and Zod Mini does not provide one. The landing page loads 159.1 KB,
  from 145.1 KB ([Performance](../PERFORMANCE.md#2026-09-27-tanstack-libraries)).
- **Docs:** ADR-0019, AGENTS, OVERVIEW, DEVELOPMENT (forms, board views,
  writing a post), PERFORMANCE, MODULE_REMOVAL (a `blog` section, and the
  `og` section's blog note), AGENT_DISCOVERY, DEPLOYMENT, FEATURES, STATUS,
  README, and both module skills.

## Migrations and environment changes

None. There is no migration, binding, variable, or secret. New pinned
dependencies: `@tanstack/react-form` 1.33.5, `@tanstack/react-table` 9.2.4,
`@tanstack/charts` 0.18.0, and `@tanstack/markdown` 0.0.15. Removed:
`recharts` 3.8.0. `src/routeTree.gen.ts` is regenerated for the blog routes.

Docs came from each package's own skills and docs for the pinned version and
from Context7: ctx7 had current indexes for TanStack Form, Router, Table, and
Charts, and none for TanStack Markdown, whose package ships its skills. The
repository's `tanstack-form` and `tanstack-table` skills describe older APIs,
Form's `validatorAdapter` and Table v8, and were not followed.

## Validation evidence

Local, on this branch:

- `pnpm verify` without `.dev.vars`: 227 Worker tests, 37 UI tests, 24 setup
  tests, and 13 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build. New tests cover the auth schemas and the Better Auth
  hook, the task and board-search schemas, the weekly stats, every blog post,
  frontmatter errors, escaped HTML, the feed, head tags, sitemap URLs, and
  post preview cards; in jsdom, the task dialog, the list view, and the
  stats panel.
- `pnpm test:e2e` with the system Chrome 153, through
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`: 5 passed in each of four runs in a
  row, the first from a cold Vite cache, about a minute each. Before these
  fixes, 6 of 10 full runs with the spec files in parallel failed: on the
  duplicate card, on auth waits, or on the dev server's module timing. `main`
  passed 3 of 3 with its two spec files. New journeys:
  - `e2e/views.spec.ts`: sign-up's password mismatch and the task dialog's
    blank title show the schema's message with `aria-invalid`; the list view
    sorts, filters, searches, and hides a column; its URL, opened in a second
    tab, restores the same view; the Stats view names both charts and the
    Worker's HTML contains their SVG; a malformed link opens the board
  - `e2e/blog.spec.ts`: the footer link, the index, a client-side navigation
    to the post, its head tags and JSON-LD in the Worker's HTML, the feed,
    the sitemap, the preview image, and a `404`
- `pnpm cf:dry-run:production` passed.
- A production build under `vite preview`:
  - `pnpm perf:bundle`: the landing page 159.1 KB gzipped in 16 files;
    `--path /blog` 155.9 KB and `--path /blog/why-tanbase-core` 156.0 KB.
    `main` built the same way loads 145.1 KB.
  - `pnpm perf:lighthouse --compress`, 3 runs each: median 97 for the
    landing page, the blog index, and the post, with accessibility 100 on
    each. A first run scored the post's accessibility 95, for primary-colored
    links in dark mode; the links now use the foreground color.
  - `/`, `/login`, `/sign-up`, `/reset-password`, `/blog`, and the post
    raised no CSP violation or console error in Chrome, with the CSP
    enforced.
  - `pnpm smoke -- --url http://localhost:4391 --environment local` passed
    with the new blog checks.
- Removal of the blog, from `18cb00a` in a local worktree: `pnpm verify`
  without `.dev.vars` passed with 214 Worker tests, `pnpm test:e2e` passed
  4, and `pnpm cf:dry-run:production` passed
  ([Module removal](../MODULE_REMOVAL.md#evidence)).

## Deployment state

| Target     | Commit    | URL                        | Date       | Result                          |
| ---------- | --------- | -------------------------- | ---------- | ------------------------------- |
| Local      | branch    | `http://localhost:4391`    | 2026-09-27 | Passed                          |
| Production | `946d08c` | `https://core.tanbase.dev` | 2026-09-28 | Passed; Lighthouse alarm failed |

Production, 2026-09-28, merge commit `946d08c`:

- Workers Build `47d6a595` deployed version `d6c5a2f5` at 08:10 UTC and
  passed its post-deploy smoke, the first to check the blog.
- `pnpm smoke -- --environment production --expect-version d6c5a2f5-ba05-4221-ad19-e92c401e365a`
  passed at 08:15 UTC.
- `/blog`, `/blog/why-tanbase-core`, `/blog/rss.xml`, and `/sitemap.xml`
  answered `200` in about 140 ms from this Mac; the sitemap lists the
  homepage, `/blog`, and the post; `/og/blog.png` and
  `/og/blog-why-tanbase-core.png` were `Cf-Cache-Status: HIT`; a missing post
  answered `404`.
- The Production performance run failed its Lighthouse alarm: 159.1 KB of
  landing JavaScript in 16 files, within the 160 KB budget, but a median of
  88, where the five runs before this change scored 91 to 96.
  - From this Mac, `pnpm perf:lighthouse` scored a median of 89 for the
    landing page and 99 for the post. Four runs of the Lighthouse CLI, each in
    a fresh browser as PageSpeed Insights uses, scored 95 to 100. The
    repository's script runs every pass in one browser, where later passes
    score lower. PageSpeed Insights' free API had no quota left that day.
  - With mobile throttling in Chrome, the headline painted at about 1.2 s,
    before the scripts finished at about 2.6 s, with no hydration errors.
  - The follow-up
    [2026-09-28-search-parser-and-signed-in-redirect](2026-09-28-search-parser-and-signed-in-redirect.md)
    takes Zod off the landing page.

## Rollback notes

Revert the merge. Nothing to migrate or clean up: no data, binding, or
resource changed. Search engines drop the blog's URLs once they return
`404`.

## Remaining work

- Deploy, then record production smoke, PageSpeed Insights for the landing
  page and a post, and blog TTFB and Worker CPU in Performance and Status.
- Give the landing page room again by moving the WebMCP tools' validation to
  the server, which would take full Zod out of the browser, about 7 KB.
- F-032, TanStack DB, and F-033, TanStack AI, stay deferred.
