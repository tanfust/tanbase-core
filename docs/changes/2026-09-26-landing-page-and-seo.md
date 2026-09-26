---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-26
---

# 2026-09-26: Landing page and SEO layer

## Summary

The homepage is now the F-016 landing page: what TanBase Core is, a map of
every Cloudflare primitive to the feature it powers, the cost model, and a
deploy block. A `seo()` head helper gives each route its title, description,
Open Graph tags, and robots policy. Indexing is opt-in, so only `/` is
indexable, with the only canonical link and `SoftwareSourceCode` JSON-LD.
`llms.txt` now links its resources in the llmstxt.org format.

## Motivation

F-016 was the remaining launch-page work. A PageSpeed Insights run of
`https://core.tanbase.dev` on mobile scored 97 Performance, 95 Accessibility,
100 Best Practices, 100 SEO, and 3/4 Agentic Browsing. Accessibility lost
points to the low-contrast eyebrow pill (`text-muted-foreground` on
`bg-muted`). Agentic Browsing failed because `llms.txt` used bare URLs
("File does not appear to contain any links"). Separately, the root route set
the homepage canonical URL and `og:url` on every page, including `/login` and
`/app`, and no page besides OAuth consent was marked `noindex`.

## Behavior and configuration changes

- `src/modules/seo/head.ts` adds `seo()`, `documentTitle()`, `jsonLd()`, and
  `softwareSourceCode()`. An indexable page must pass a canonical `path`; a
  `noindex` page cannot, and gets no canonical link or `og:url`. JSON-LD
  renders as a head `<script type="application/ld+json">` with `<` escaped.
  There is no `og:image` until F-017, so `twitter:card` is `summary`.
- The root route no longer emits a canonical link or `og:url`, and defaults
  to `robots: noindex`. The homepage opts in with `index, follow`. Login,
  sign-up, password reset, board, settings, and OAuth consent call
  `seo({ noindex: true })`. Titles follow `Page · TanBase Core`; the homepage
  is `TanBase Core: TanStack Start on Cloudflare Workers`.
- `src/routes/index.tsx` and `src/components/landing/` render the landing
  page from `src/modules/seo/homepage.ts`. The page has a hero with "Get the
  source" and "Try the live board", the primitive map (one Worker, twelve
  wired features, and the binding, secret, route, or config key each uses),
  the allowances checked against Cloudflare's pricing pages on 2026-09-26,
  each with its own unit and R2 and Workers AI marked as free tiers on every
  plan, the cost risks and the guardrails that run today, the planned 30-day
  invoice, and a deploy block with the four install commands, a copy button,
  and a link to the install guide. On narrow screens the commands wrap under a
  hanging indent and come before the guide link. The eyebrow pill and the four
  feature cards are gone. Button-styled links on the page are real links
  styled with `buttonVariants()`, not Base UI buttons with `role="button"`.
- `src/styles.css` themes text selection with a primary tint across the app;
  the blue panels invert it.
- The homepage Markdown representation carries the same primitive map, cost
  model, and install commands.
- `src/modules/seo/llms.txt` follows llmstxt.org: a summary blockquote, then
  `Docs`, `For agents`, and `Optional` sections of Markdown links. Its
  capability summary now includes realtime, reminders, and AI breakdown.
- `updateLlmsOrigin()` in the guided installer now rewrites every occurrence
  of the current origin in `llms.txt`, not only the `Production origin` line.
  A fork's `llms.txt` previously kept `https://core.tanbase.dev` in its MCP
  and discovery links.
- `pnpm smoke` checks that `/` has exactly one canonical URL, allows indexing,
  and carries `SoftwareSourceCode` JSON-LD naming the canonical URL, and that
  `/login` is `noindex` with no canonical link. The title check accepts the
  new homepage title.
- `siteConfig` gains `tagline` and `author`, and `sourceFileUrl()` builds
  links to repository files.
- `public/manifest.json`, the unreferenced "Create TanStack App Sample"
  manifest pointing at icons that do not exist, is removed.
- OVERVIEW's primitive map no longer claims the Agents SDK and an
  `MCP_OBJECT` binding for MCP (ADR-0014 chose neither), and its cost table
  adds the verified R2, Queues, and Workers AI allowances. README no longer
  calls background work, AI, and MCP roadmap items.

## Migrations and environment changes

None. No bindings, variables, secrets, or migrations change.

## Validation evidence

Local:

- `src/modules/seo/head.test.ts`: titles, indexable and `noindex` output,
  JSON-LD escaping, and the structured data.
- `src/modules/seo/negotiation.test.ts`: the homepage Markdown includes every
  primitive row, allowance row, the planned invoice, and the install commands.
- `src/components/landing/deploy-panel.ui.test.tsx`: commands render, the
  guide link resolves, and Copy writes the commands and survives a refused
  clipboard.
- `scripts/setup/core.test.mjs`: `updateLlmsOrigin()` rewrites every origin
  and rejects a file without the origin line; the current `llms.txt` has all
  11 occurrences rewritten.
- `pnpm smoke -- --url http://localhost:4391 --environment local` against
  `vite build` plus `vite preview`, under the enforcing CSP: passed.
- Lighthouse 13 mobile, on the same local build: Accessibility 100, Best
  Practices 100, Agentic Browsing 100. SEO scored 66 only because the local
  `robots.txt` disallows crawling by design.
- The landing route chunk is 5.0 KB gzipped, up from 1.7 KB; the shared entry
  chunk and the stylesheet are unchanged within 1 KB.
- Screenshots at 1440 px light and dark and 375 px light: no horizontal
  scroll at 375 px. A fresh-context design review asked for six fixes (mobile
  command wrapping and order, allowance units, the dark-mode guide button, a
  key for the chips, the rail ending at the last node, and themed selection);
  all six are applied and recaptured.
- `pnpm verify` steps without `.dev.vars`: 175 Worker, 21 UI, 23 setup, and 6
  script tests passed, with lint, docs, schema, types, boundaries, and build.
  Prettier passed on every tracked and new file; the untracked PostHog wizard
  skill folder in this checkout is not part of the change.
- `pnpm cf:dry-run:production` — passed.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result       |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------------ |
| Local      | Working tree based on `b4c50bb` | `http://localhost:4391`    | 2026-09-26 | Passed       |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the change. The previous homepage, root head, and `llms.txt` return;
nothing persistent depends on them.

## Remaining work

- Record production smoke and a fresh PageSpeed Insights run after deploy.
- DNS-AID, the last F-016 item, waits on the operator enabling DNSSEC.
- F-017 adds the `og:image` preview; F-023 replaces the deploy placeholder
  with a Deploy to Cloudflare button.
- Other pages still render links through Base UI `Button` with
  `role="button"`; that is a separate fix.
