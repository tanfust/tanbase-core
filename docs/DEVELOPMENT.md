---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# Development

## Prerequisites

- Node.js `^22.13.0` or `>=24.0.0`
- pnpm `10.11.1`
- A Cloudflare account only for remote deployment

Install from the reviewed lockfile:

```sh
pnpm install --frozen-lockfile
```

The package-manager version matches Cloudflare Workers Builds. Do not bypass
lockfile or supply-chain validation in contributor or CI instructions.

## Commands

| Command                                                              | Purpose                                                                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run setup`                                                     | Guided local and production installation                                                                                                    |
| `pnpm run setup --local-only`                                        | Prepare only isolated local development                                                                                                     |
| `pnpm dev`                                                           | Run TanStack Start inside the Workers runtime on port 3000, with `env.local`                                                                |
| `pnpm verify`                                                        | Format, lint, docs, migration, type, test, boundary, and build gates                                                                        |
| `pnpm test:e2e`                                                      | Run the isolated local-D1 authentication, board, views, blog, and WebMCP browser journeys, one spec at a time                               |
| `pnpm test:dev-client`                                               | Load the dev server's client module graph and fail on import-protection errors                                                              |
| `pnpm docs:check`                                                    | Validate frontmatter, required sections, and internal links                                                                                 |
| `pnpm db:generate`                                                   | Generate a migration from the Drizzle schema and format its snapshot                                                                        |
| `pnpm db:check`                                                      | Check generated Drizzle migration history                                                                                                   |
| `pnpm db:migrate:local`                                              | Apply pending migrations to isolated local D1 storage                                                                                       |
| `pnpm db:seed:local`                                                 | Idempotently add local-only project and task fixtures                                                                                       |
| `pnpm cf:typegen`                                                    | Regenerate Worker binding types                                                                                                             |
| `pnpm cf:dry-run:production`                                         | Build production configuration and run Wrangler dry run                                                                                     |
| `pnpm cf:dry-run:default`                                            | Build the top-level configuration, which the Deploy button deploys, and run Wrangler dry run                                                |
| `pnpm cf:deploy:production`                                          | Build, migrate, deploy, and smoke production; superseded Workers Builds skip the deploy; changes live remote state                          |
| `pnpm smoke -- [--url <url>] --environment <name>`                   | Verify public and protected-route contracts; production defaults to the canonical origin; add `--config default` for a top-level deployment |
| `pnpm perf:bundle -- [--url <url>] [--path <path>]`                  | Check a page's JavaScript against the landing budget, the landing page by default ([Performance](PERFORMANCE.md))                           |
| `pnpm perf:lighthouse -- [--url <url>] [--path <path>] [--compress]` | Run Lighthouse mobile several times and check the median score; `--compress` for a local `vite preview`; needs Node.js 22.19 or newer       |
| `pnpm perf:ttfb -- [--url <url>] [--path <path>]`                    | Measure time to first byte from Tunis and US East with Globalping probes                                                                    |

## Generated files

- `src/routeTree.gen.ts` is generated by TanStack Router.
- `src/worker-configuration.d.ts` is generated by Wrangler.

Both are committed. CI regenerates Worker types and fails when the working tree
changes. Never hand-edit generated files.

`cf:typegen` uses the committed empty `scripts/typegen.env` so ignored local
secrets never change the committed binding declarations.

Drizzle schema snapshots and SQL under `drizzle/migrations/` are also committed.
Generate them with `pnpm db:generate`, review the SQL, then apply the SQL with
Wrangler. Do not use Drizzle's migration runner against D1.

## Wrangler configuration

`wrangler.jsonc` has three sections ([ADR-0017](decisions/0017-wrangler-configuration-layout.md)):

| Section          | Used by                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Top level        | `pnpm build`, the Deploy to Cloudflare button, and `pnpm run deploy`: a production configuration any account can deploy |
| `env.local`      | `pnpm dev`, the local database scripts, and the Worker tests                                                            |
| `env.production` | `pnpm cf:build:production`: the TanBase demo, or your pinned installation after `pnpm run setup`                        |

`vite dev` selects `env.local` on its own, however it is started. Browser
tests use the separate `wrangler.e2e.jsonc`. A new binding goes in each
section that uses it; environments inherit nothing from the top level.

## Local database workflow

The local database uses `env.local` and isolated `.wrangler` persistence. It
never connects to production because local commands explicitly use `--local`
and never use `--remote`.

```sh
pnpm db:migrate:local
pnpm db:seed:local
pnpm dev
```

The seed uses stable IDs and `INSERT OR IGNORE`, so rerunning it creates no
duplicates. Tests use `@cloudflare/vitest-plugin`, apply the real generated SQL,
and receive an isolated D1 database for each test file.

## Local attachment workflow

`env.local` binds `FILES` to a simulated local R2 bucket,
so attachments work in `pnpm dev`, the Workers-runtime tests, and the browser
suite without an account. Local objects live in `.wrangler` state. Apply the
local migrations first; attachments use migration `0002`.

Upload rules live in `src/modules/files/limits.ts` and are shared by the
browser, the upload route, and the database constraint.

## Local realtime workflow

`pnpm dev` runs `BoardRoom` in the local Workers runtime and proxies WebSocket
upgrades, so two browser windows on the same board update each other. The
header shows **Live** once the socket is open. Durable Object classes must be
exported from `src/server.ts` and, for the Workers-runtime tests, from
`test/worker.ts`.

## Local AI workflow

Workers AI runs only remotely, so the local and browser-test configurations
have no `AI` binding and **Break down with AI** is hidden. `TaskBreakdownWorkflow`
itself runs locally; the tests mock its generation step and inject fake models,
and Vitest runs with `remoteBindings: false` so no test needs Cloudflare
credentials.

To try the real model locally, add this to `env.local` in `wrangler.jsonc`
without committing it:

```jsonc
"ai": { "binding": "AI", "remote": true },
```

`pnpm dev` then needs `wrangler login`, every breakdown is billed to the
account, and the first call creates the account's `default` AI Gateway.

## Local MCP workflow

`pnpm dev` serves `/mcp` and the OAuth endpoints against local D1. Point MCP
Inspector at `http://localhost:3000/mcp`, sign in with a verified local
account, and select **Allow** on `/oauth/consent`. Local clients with
loopback redirect URIs must register as `native` applications; web clients
need HTTPS redirect URIs. Tests call the tools and the MCP handler directly,
without tokens, and cover the `401` challenge and discovery documents.

The agent discovery documents describe the local origin, for example
`http://localhost:3000/mcp/server-card`, and
`curl -H 'Accept: text/markdown' http://localhost:3000/` returns the homepage
as Markdown. Browsers rarely expose WebMCP yet, so `e2e/web-mcp.spec.ts`
installs a `navigator.modelContext` stand-in before the page loads and drives
the registered tools signed out and signed in.

## Local email workflow

`sendEmail()` defaults to a metadata-only log when `EMAIL_FROM` is empty. The
log contains only the template name and recipient count; it never contains
addresses, message bodies, verification links, reset tokens, or credentials.
The native `EMAIL` binding exists only in `env.production`, so Email Service
onboarding cannot block a fresh account or local development.

To exercise the native binding locally, first add `send_email` to `env.local`
in `wrangler.jsonc`, regenerate types, and set `EMAIL_FROM` in ignored
`.dev.vars` to a bare address on an onboarded sender domain; the site name is
used as the display name. Wrangler simulates
delivery unless the binding explicitly uses `remote: true`. Templates render
both HTML and plain text at send time and have Workers-runtime coverage.

## Local authentication workflow

Authentication uses D1 for users, accounts, sessions, and one-time
verification records. Apply the migrations, then put a development-only secret
of at least 32 characters in the ignored `.dev.vars` file:

```dotenv
BETTER_AUTH_SECRET=<generate-a-development-secret>
```

Generate the value locally with a cryptographically secure password generator;
never copy a production secret into local development. `BETTER_AUTH_URL` is
already `http://localhost:3000` in `env.local`. Server
code reads the public origin through `publicOrigin()` in
`src/platform/origin.ts`, which falls back to the request's origin when
`BETTER_AUTH_URL` is empty.

Local development and the browser suite use Cloudflare's always-pass Turnstile
test site key from `env.local`. Add its paired test secret
to `.dev.vars`; `pnpm run setup --local-only` adds it when missing:

```dotenv
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Without it, authentication fails closed with "Authentication is not
configured". The widget loads from `challenges.cloudflare.com`, so the auth
pages and `pnpm test:e2e` need network access. Wrangler simulates the
`AUTH_LIMITER` binding locally; all local requests share one client bucket.

```sh
pnpm db:migrate:local
pnpm dev
```

With `EMAIL_FROM` empty, verification and reset messages use the safe metadata
fallback and do not expose their links, and new accounts need no
verification: sign-up signs them in and opens the board. Workers-runtime tests inject a fake
sender and exercise the complete core flow without real delivery. The browser
suite uses `wrangler.e2e.jsonc`, port `3110`, and `.wrangler/e2e-state`; it
prepares one verified account only in that isolated local D1 database and reads
reset tokens only from the same local verification storage.

Install the matching browser once with `pnpm exec playwright install chromium`,
or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing compatible Chromium
binary before running `pnpm test:e2e`.

`pnpm test:e2e` runs the spec files one at a time, with `--workers=1`. They
share one dev server, and Vite's dev module runner can hand a request a
module that another request is still evaluating, which fails with "Cannot
access `__vite_ssr_import_N__` before initialization" on a cold server. A
production bundle evaluates each module once, so this affects only the dev
server.

The public authentication pages cover sign-up, verification guidance, sign-in,
verification resend, forgot password, and reset password. Protected routes use
the responsive application shell, while `/settings` manages the display name,
password, and persisted light, dark, or system appearance.

## Security headers and logging

The Worker entry adds security headers to every response and a nonce-based CSP
to documents built for production. `pnpm dev` omits the CSP so Vite's client
works; use `pnpm build` and `pnpm exec vite preview --port 4291` to exercise
the enforcing policy. Render inline scripts with `ScriptOnce` so they carry the
nonce, and add any new external origin to `src/platform/security-headers.ts`.

Analytics stays off locally. To test the PostHog integration, add a
`POSTHOG_KEY` to ignored `.dev.vars`, then build and preview; remove it
afterwards so local sessions never report to a real project.

Log with `log.info`, `log.warn`, or `log.error` from `src/platform/log.ts`.
Entries are structured objects that include the request ID from
`src/platform/request-context.ts`; never log credentials, tokens, message
bodies, or recipient addresses.

## Branding

The app's name, logo, icons, and machine name come from `siteConfig` in
`src/lib/site.ts`; [Make it yours](../README.md#make-it-yours) lists every
field. Use `siteConfig` in new copy instead of writing the name:
`src/lib/branding.ui.test.ts` fails when the template's name appears in
`src/` outside that file. A monochrome logo is drawn through a CSS mask in
the header and tinted in the preview image, so its SVG's own colors do not
matter.

## Page metadata

Give every page route a `head` that calls `seo()` from
`src/modules/seo/head.ts`. Pages stay out of search results by default; pass
`path` only for a public page, and add the same path to the sitemap in
`src/modules/seo/discovery.ts`. Homepage copy lives in
`src/modules/seo/homepage.ts`, which renders both the page and its Markdown
representation, so edit claims there and keep them true of production.

An indexable page can also name a link preview image:
`seo({ image: ogImage("home") })`, as the homepage does. Cards live in
`src/modules/og/cards.ts`; add one there to give a page its own. A page that
names no image keeps a text-only card. `/og/<slug>.png` draws a registered card
with Takumi and answers `404` for any other slug
([ADR-0018](decisions/0018-preview-images-on-the-worker.md)). Open
`http://localhost:3000/og/home.png` under `pnpm dev` to see a card. The first
image drawn in a fresh isolate takes about half a second there, while Vite
loads the renderer. Workers Caching runs only on Cloudflare, so locally every
request draws the image again.

The blog's pages build their head tags in a server function instead:
`src/modules/blog/pages.server.ts` calls `seo()` on the Worker, and the route
returns what its loader fetched. Route options load with every page, so this
keeps the blog's head code off the landing page.

## Forms

Build a form with `useAppForm()` from `src/components/form.tsx`, as the auth
pages and the task dialog do:

- Pass the schema the server applies, or one that extends it with fields that
  stay in the browser, such as a password confirmation, as `onDynamic`, with
  `validationLogic: validateOnSubmit`. Fields then validate on the first
  submit and on every change after it.
- Render fields with `field.TextField` or `field.TextareaField`, which draw
  the shadcn/ui `Field` markup with `aria-invalid` and an error linked
  through `aria-describedby`, and the button with `form.SubmitButton`.
- Keep the inputs' `required`, `type`, and length attributes; the browser's
  own checks still run first. Keep a server error in component state and show
  it with `FieldError`.
- Import `@/lib/zod-config` in a schema module the browser loads. It turns
  off Zod's JIT before the first schema, since its eval probe is a CSP
  violation.

The auth schemas in `src/modules/auth/schemas.ts` also run on the server: a
Better Auth `before` hook in `src/modules/auth/auth.server.ts` checks each
endpoint's body, so every client gets the same rules and messages.

## Board views

`/app` shows a project as a board, a list, or stats. The view and the list's
search, status filter, sort, and hidden columns are search params, validated
by `boardSearchSchema` in `src/modules/tasks/board-search.ts`, with Zod Mini
because route options load with every page. A malformed param falls back to
its default, and the route strips defaults from links. The list
(`src/components/board/task-table.tsx`, TanStack Table) and the stats
(`src/components/board/project-stats.tsx`, TanStack Charts) read the board's
query data; changing the view never fetches. The stats panel loads only when
someone opens it.

The dev server pre-bundles the route-level TanStack packages listed in
`routeDependencies` in `vite.config.ts`. Add a package there when a route
starts importing it, or the dev server re-optimizes in the middle of a
session, reloads the page, and can load React twice.

## Writing a blog post

Add a Markdown file to `content/blog/`. Its name is the post's slug, in
lowercase words joined by hyphens, such as `content/blog/first-post.md` for
`/blog/first-post`. Start it with frontmatter:

```md
---
title: First post
description: One or two sentences for the index, search results, and the feed.
date: 2026-10-01
author: Your name
tags: [tanstack, cloudflare-workers]
---
```

Start headings at `##`; the page draws the title as its only `h1`. Raw HTML
is off, and links with executable URLs are dropped. Posts are bundled into the
Worker at build time, so a post ships with a deploy
([ADR-0019](decisions/0019-blog-from-repository-markdown.md)).

`pnpm exec vitest run src/modules/blog` compiles every post and fails with
the file and the field when frontmatter is wrong, so a bad post fails CI
rather than production. Under `pnpm dev`, open `/blog`, the post, its preview
image at `/og/blog-<slug>.png`, and `/blog/rss.xml`.

## Server-only boundaries

TanStack import protection runs with error behavior in development and builds.
Files matching `*.server.*`, files under `src/db/`, and files under
`src/platform/` must not enter the client graph. Route-importable RPC definition
files stay unsuffixed; their platform, database, secret, and binding
implementations belong behind the protected boundary.

`pnpm test:boundaries` also rejects a `getDb()` import anywhere except
`src/db/` and `src/modules/*/repository.server.ts`.

`pnpm test:boundaries` copies the project to a temporary directory, introduces a
deliberate forbidden import, and proves that the build rejects it.

## Contribution workflow

1. Read [AGENTS.md](../AGENTS.md), [status](STATUS.md), and the relevant feature.
2. Implement the smallest vertical slice and its tests. For a new table, a new
   module, removing a module, or a deploy, follow the matching skill in
   `.claude/skills/`.
3. Update active docs and add a [change record](changes/TEMPLATE.md).
4. Run `pnpm cf:typegen` when Worker configuration changed.
5. Run `pnpm verify` and the relevant deployment dry run.
6. Record actual evidence. A local pass is not a production deploy.
