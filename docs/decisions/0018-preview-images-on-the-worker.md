---
status: accepted
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# ADR-0018: Preview images drawn on the Worker and kept in Workers Caching

## Context

F-017 asks for Open Graph images generated on the Worker and cached. Links
shared to chat apps and social networks showed no image: `seo()` emitted a
`summary` card with text only.

Constraints:

- **No browser.** Browser Rendering is out of scope for v1 (OVERVIEW), so the
  image has to be drawn from a layout description inside the Worker.
- **CPU.** Drawing an image costs milliseconds of CPU. Workers Free allows
  10 ms per request, and every render is billed CPU on Workers Paid.
- **Abuse.** An endpoint that draws text from the URL can be made to render
  unbounded variations, each one a cache miss that costs CPU.
- **Origins.** The Worker answers on `workers.dev`, custom domains, and the
  request's own origin ([ADR-0016](0016-deploy-without-personalization.md)).

## Decision

- **Takumi draws the images.** `@takumi-rs/wasm` lays out a node tree and
  encodes a PNG in one WebAssembly module. It reads WOFF2, so the image uses
  the Inter variable font the site already ships. Only the WebAssembly package
  is installed. `takumi-js` would add native binaries for eight platforms that
  the Worker never loads.
- **Cards are a fixed set.** `src/modules/og/cards.ts` names every card by
  slug. `/og/<slug>.png` draws a registered card and answers `404` for any
  other slug, so no request can choose the text. A card has no hostname on it.
- **Workers Caching keeps them.** The named entrypoint `OgImage` serves the
  images, and `exports.OgImage` in each Wrangler section turns on Workers
  Caching for that entrypoint alone. The default entrypoint, and so every
  page, API, and auth response, stays uncached. The Worker hands the
  entrypoint only the method and path: the query string is part of the cache
  key, so passing it on would let `?1`, `?2`, and so on each force a render,
  and dropping the headers keeps cookies and credentials away from the
  renderer. The Worker version is part of the cache key too, so a deploy draws
  each image again. Cloudflare turns a `HEAD` on a cold cache into a `GET`;
  an uncached `HEAD` answers with no body and `no-store`, so it can never
  become the entry `GET` shares. Responses send
  `Cloudflare-CDN-Cache-Control: max-age` of a year for the edge and
  `Cache-Control: max-age` of a day for browsers and crawlers.
- **Indexable pages name an image.** A page that names a canonical path can
  pass `image: ogImage(slug)` to `seo()`, which adds `og:image` with its type,
  size, and alt text, and a `summary_large_image` card. The homepage names
  `home`. `head.ts` imports only the image's type, so the card list stays out
  of routes that name no image. `noindex` pages keep a text-only card.

## Consequences

- The Worker upload grows from 5.8 MiB to 9.5 MiB, 3.0 MiB gzipped; the
  WebAssembly module is 3.8 MB. Workers allow 64 MiB, with no compressed
  limit. Over three local `wrangler check startup` runs each, startup took
  47.5 to 52.5 ms of active time without the renderer and 47.7 to 55.3 ms with
  it, a difference within the runs' own spread. The renderer is instantiated
  only on the first image request.
- Locally, the first render in an isolate took about 56 ms and later renders
  about 10 ms. With request collapsing and the tiered cache, Cloudflare draws
  each card about once per deploy. On Workers Free a first render can exceed
  the 10 ms CPU limit and fail; Workers Paid allows 30 seconds.
- Cache hits are billed as requests with no CPU time.
- Workers Caching serves one image to every origin, which is why cards carry
  no hostname.
- A fork adds a card by adding an entry to `ogCards` and passing
  `ogImage(slug)` to a route's `seo()` call.

## Alternatives

- **Satori and resvg.** The common route converts JSX to SVG with Satori,
  then rasterizes with resvg. Its WebAssembly is similar in size, but it
  needs two libraries, TTF or WOFF fonts rather than WOFF2, and two passes per
  image.
- **Images generated at build time.** Static assets need no CPU at request
  time, but F-017 requires drawing on the Worker, and fork-specific cards would
  need a build step outside Vite.
- **The Cache API.** `caches.default` needs code for every lookup and store.
  It has no request collapsing or tiered cache, and on `workers.dev` it stores
  nothing, which leaves out button deployments.
- **Titles from the query string.** Arbitrary text would make the endpoint a
  free rendering service and defeat the cache.
