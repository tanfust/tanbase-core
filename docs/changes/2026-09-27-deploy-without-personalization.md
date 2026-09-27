---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: A deployment works without personalization

## Summary

The Worker resolves its public origin at runtime and requires email
verification only when it can send email. A deployment that skips the guided
installer, as a Deploy to Cloudflare button does, now gets correct links and
working sign-up on its `workers.dev` URL. This is the first half of F-023.

## Motivation

The button deploys the repository as committed. Before this change, links,
feeds, and structured data named `core.tanbase.dev`, compiled in; auth needed
`BETTER_AUTH_URL` before a deployment had a URL; and sign-up always required
an email a fresh account cannot send.

## Behavior and configuration changes

- New `src/platform/origin.ts`: `publicOrigin()` returns `BETTER_AUTH_URL`
  when set, otherwise the request's origin, which `src/server.ts` now records
  in the request context. A set value that is not a URL fails closed.
- Better Auth, MCP identifiers, discovery documents, and the attachment and
  realtime origin checks use it.
- Canonical URLs, `og:url`, the sitemap, robots, discovery `Link` headers,
  the Markdown homepage, JSON-LD, and `llms.txt` use it too. `canonicalUrl()`
  and the SEO helpers take the origin as an argument, and the homepage loads
  it through the new `getSiteOrigin()` server function.
- `isEmailDeliveryConfigured()` in the email module is true when both the
  `EMAIL` binding and `EMAIL_FROM` are set. Better Auth requires email
  verification, and sends it on sign-up, only then. Without email:
  - sign-up signs the new account in and opens its board
  - the login copy drops "verified"
  - the reset page says reset links cannot be emailed
- Due-date reminders need `BETTER_AUTH_URL`, since queue handlers have no
  request. Without it they are logged and acknowledged unclaimed.
- `pnpm smoke` expects the environment's configured origin, or the tested
  URL's own origin when none is configured.
- New ADR-0016. `AGENTS.md` adds the rule to read the origin through
  `publicOrigin()`.

## Migrations and environment changes

None. TanBase production pins `BETTER_AUTH_URL` and has email delivery, so it
behaves as before.

## Validation evidence

Local:

- New tests:
  - `src/platform/origin.test.ts`
  - auth: sign-up without email delivery signs the account in with no
    verification email; auth takes the request's origin when none is
    configured and fails closed with neither or with an invalid value
  - reminders: skipped and left unclaimed without an origin
  - SEO: all tests use a fork's origin, so each proves the runtime origin is
    used
- `pnpm verify` steps without `.dev.vars`: 182 Worker, 21 UI, 23 setup, and 6
  script tests passed, with format, lint, docs, schema, types, boundaries, and
  build.
- `pnpm test:e2e` with the system Chrome: 3 passed. The e2e Worker has no
  email delivery, so its sign-up now lands on the board signed in.
- `pnpm smoke -- --url http://localhost:4391 --environment local` against
  `vite build` plus `vite preview` — passed. The canonical link, JSON-LD,
  sitemap, and `llms.txt` name the configured `http://localhost:3000`.

Production:

- Workers Build `b8a6a35f` deployed merge `af8a708` as version `8f17bbc6` at
  13:26 UTC, two minutes after PR #38 merged, and its post-deploy smoke
  passed. The four GitHub checks passed on the merge commit.
- `pnpm smoke -- --environment production --expect-version 8f17bbc6-9a1c-4260-8ccd-bd99a9620fee`
  — passed at 13:54 UTC.
- Production pins `BETTER_AUTH_URL` and has email delivery, so it behaves as
  before: the canonical link, JSON-LD, and sitemap name
  `https://core.tanbase.dev/`, login asks for a verified email, and the reset
  page shows no notice. The request-origin fallback does not apply here; it is
  exercised by the tests and by the button deploy in part 2.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------ |
| Local      | Working tree based on `6d65e33` | `http://localhost:4391`    | 2026-09-27 | Passed |
| Production | `af8a708` / version `8f17bbc6`  | `https://core.tanbase.dev` | 2026-09-27 | Passed |

## Rollback notes

Revert the change. Deployments that pin `BETTER_AUTH_URL` and send email are
unaffected either way.

## Remaining work

The second half of F-023 makes the top-level Wrangler configuration a
generic production configuration the Deploy to Cloudflare button can deploy,
moves local development to `env.local`, and adds the button.
