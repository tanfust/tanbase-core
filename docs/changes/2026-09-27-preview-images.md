---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: Preview images drawn on the Worker

## Summary

The homepage now has a link preview image. The Worker draws it at
`/og/home.png` with Takumi, and Workers Caching keeps it until the next deploy.
This is F-017 ([ADR-0018](../decisions/0018-preview-images-on-the-worker.md)).

## Motivation

Links to TanBase Core showed a text-only card in chat apps and social
networks. F-017 asks for the image to be drawn on the Worker and cached.

## Behavior and configuration changes

- **New `og` module:**
  - `cards.ts` lists the cards by slug, with alt text and `ogImage()`
  - `content.server.ts` holds what each card draws, taken from the homepage
    copy
  - `render.server.ts` draws a 1200×630 PNG with `@takumi-rs/wasm` and the
    Inter variable font the site already ships
  - `entrypoint.server.ts` holds the `OgImage` entrypoint
- **Routing:**
  - `/og/<slug>.png` draws a registered card; any other slug answers `404`
    and any method but `GET` and `HEAD` answers `405`
  - `src/server.ts` sends `/og/` to `ctx.exports.OgImage` with only the
    method and path, through `imageRequest()`, so a query string cannot add
    cache entries and no cookies or credentials reach the renderer
  - an uncached `HEAD` answers with no body and `no-store`; on Cloudflare a
    `HEAD` on a cold cache arrives as a `GET`
- **Caching:**
  - `exports.OgImage` in every Wrangler section, including
    `wrangler.e2e.jsonc`, turns on Workers Caching for that entrypoint alone
  - images send `Cloudflare-CDN-Cache-Control: public, max-age=31536000` and
    `Cache-Control: public, max-age=86400`
- **Head tags:** `seo()` takes an optional `image`. The homepage passes
  `ogImage("home")`, which adds `og:image` with its type, size, and alt text,
  and `twitter:card: summary_large_image`. Other pages keep a text-only
  `summary` card. `head.ts` imports only the image type, so the card list
  stays out of routes without an image; the entry chunk grew by 107 bytes
  gzipped.
- **Homepage:** the primitive map lists link preview images on Workers
  Caching.
- **`pnpm smoke`** checks the homepage's `og:image` and card type. It also
  checks that `/og/home.png` is a 1200×630 PNG with its cache policy and that
  an unknown card answers `404`.
- **Docs:**
  - ADR-0018, AGENTS, OVERVIEW, DEVELOPMENT, AGENT_DISCOVERY, README, and
    FEATURES
  - the module removal guide, with an `og` section
  - both module skills, for cached entrypoints; they and the guide also now
    say the `ai` binding is in the top level as well as `env.production`

## Migrations and environment changes

None. There is no new binding, secret, or resource. The new dependency is
`@takumi-rs/wasm` 2.14.0.

## Validation evidence

Local, from `0d47e61` and the evidence commit on top of it:

- `pnpm verify` without `.dev.vars` or `.env`: 194 Worker tests, 21 UI, 23
  setup, and 9 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build. The new Worker tests:
  - render through `exports.OgImage` and check the PNG signature, size, and
    headers
  - check `HEAD`, `404`, and `405`
  - reject prototype names such as `/og/constructor.png`
  - check that `imageRequest()` drops the query string and headers
- `pnpm cf:dry-run:production` and `pnpm cf:dry-run:default` passed with
  `exports.OgImage` in the built configuration.
  - The upload grew from 5950.91 KiB to 9775.57 KiB, 3022.01 KiB gzipped.
  - Wrangler rejects `exports` beside `migrations` only for Durable Object
    exports, so `BoardRoom`'s `v1` migration is unaffected.
- `pnpm test:e2e` with the system Chrome: 3 passed.
- `vite preview` of the top-level build:
  - `/og/home.png` returned the card, 54,051 bytes
  - unknown slugs returned `404` and `POST` returned `405`
  - a request with a cookie and an `Authorization` header still got the image
  - the homepage named `http://localhost:4391/og/home.png`, and `/login` kept
    a text-only card
  - `pnpm smoke -- --url http://localhost:4391 --environment production --config default`
    passed
- `pnpm dev` served the card: about 0.5 s for the first request while Vite
  loaded the renderer, then 25 ms.
- Takumi, while prototyping, on this Mac:
  - the first render in an isolate took about 56 ms, including instantiating
    the module and registering the font
  - later renders took about 10 ms
- `wrangler check startup`, three runs each: 47.5 to 52.5 ms of active time
  without the renderer, 47.7 to 55.3 ms with it.
- Removal, from `0d47e61` in a local worktree:
  - `pnpm verify` without `.dev.vars` passed with 182 Worker tests
  - both dry runs passed, at 5951.71 KiB
  - `pnpm test:e2e` passed after clearing `.wrangler/e2e-state` left by a
    first run without `.dev.vars`

Production, 2026-09-27, merge commit `5d055b0`:

- Workers Build `48697ce9` deployed version `1590a9be` at 16:56 UTC and
  passed its post-deploy smoke. That smoke made the first production request
  for `/og/home.png`.
- `pnpm smoke -- --environment production --expect-version 1590a9be-d844-4c5e-8989-c90d697ee1c1`
  passed at 16:57 UTC.
- Workers Logs show two invocations of the `OgImage` entrypoint since the
  deploy:
  - the render of `/og/home.png`, `200`, in 312 ms of CPU and 314 ms of wall
    time
  - the smoke's `/og/missing.png`, `404`, in 0 ms of CPU
- **Cache:** every later request for the image returned `Cf-Cache-Status: HIT`
  without running the entrypoint, from `GIG` and `MRS`, with `age` counting
  from the render.
  - A request with a random query string was also a `HIT`.
  - Cloudflare stripped `Cloudflare-CDN-Cache-Control` from responses to
    clients.
  - The production PNG is byte-for-byte the local render, 54,051 bytes.
- **CPU:** 312 ms is inside Workers Paid's 30-second limit, and far over
  Workers Free's 10 ms.

## Deployment state

| Target     | Commit                                | URL                        | Date       | Result |
| ---------- | ------------------------------------- | -------------------------- | ---------- | ------ |
| Local      | Working tree based on `0d47e61`       | `http://localhost:4391`    | 2026-09-27 | Passed |
| Production | `5d055b0` / Worker version `1590a9be` | `https://core.tanbase.dev` | 2026-09-27 | Passed |

## Rollback notes

Revert the change. Pages return to text-only cards. Cached images stop being
served once the reverted version deploys, since the version is part of the
cache key; sites that already fetched the preview keep their copy.

## Remaining work

- Preview images need Workers Paid. A fork on Workers Free gets a failing
  `/og/home.png` and a failing smoke check for it.
- F-019 budgets should count the larger Worker upload.
