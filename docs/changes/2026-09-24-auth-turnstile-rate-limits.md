---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# 2026-09-24: Turnstile and rate limits on auth

## Summary

Added Cloudflare Turnstile to sign-up, sign-in, password-reset requests, and
verification resends through Better Auth's captcha plugin. Added the
`AUTH_LIMITER` rate-limit binding for sensitive auth `POST` requests, trusted
client-IP detection, clear UI states, a production smoke guard, and installer
support (F-006).

## Motivation

The public auth forms could be scripted to create accounts, guess passwords,
and trigger verification or reset emails from the project's sender domain.
Challenge and rate-limit guardrails must ship before production email delivery
is enabled.

## Behavior and configuration changes

- Better Auth's `captcha` plugin with the `cloudflare-turnstile` provider
  requires an `x-captcha-response` token on `/sign-up/email`, `/sign-in/email`,
  `/request-password-reset`, and `/send-verification-email`. Missing tokens
  return `400 MISSING_RESPONSE`; failed tokens return `403`. Production tokens
  must report the canonical hostname.
- A configured `TURNSTILE_SITE_KEY` requires `TURNSTILE_SECRET_KEY`; auth fails
  closed with "Authentication is not configured" without it. An empty site key
  disables the challenge.
- `src/routes/api/auth/$.ts` applies `AUTH_LIMITER` (10 requests per 60 seconds
  per client IP and endpoint) to sign-up, sign-in, reset requests, password
  resets, and verification resends, returning `429` with `Retry-After: 60`.
- Better Auth reads client IPs from `cf-connecting-ip` instead of the
  client-controllable `x-forwarded-for`, and its per-isolate in-memory limiter
  is disabled.
- The login, sign-up, and forgot-password forms render a theme-matched,
  flexible Turnstile widget, send a fresh token with each protected call, reset
  it afterwards, and show messages for a failed challenge, a widget that cannot
  load, and rate limiting.
- The smoke suite asserts that a token-less sign-in is rejected whenever the
  target environment configures a site key.
- The installer adds Cloudflare's Turnstile test secret to `.dev.vars`, keeps
  the production site key only when the Worker has `TURNSTILE_SECRET_KEY`, and
  otherwise clears it so forks deploy with the challenge disabled rather than
  failing closed.

## Migrations and environment changes

No database migration. Added `TURNSTILE_SITE_KEY` variables and the
`AUTH_LIMITER` `ratelimits` binding to the local, production, and browser-test
Wrangler configurations. Local and browser tests use Cloudflare's always-pass
test key. Production uses site key `0x4AAAAAAFCqjjSEV5UqAPfK` of the managed
"TanBase Core" widget, created on 2026-09-24 for `core.tanbase.dev`. Worker
types were regenerated.

Existing clones must add `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`
to `.dev.vars`, or rerun `pnpm run setup --local-only`. The production
`TURNSTILE_SECRET_KEY` Worker secret must be set before this change deploys,
because the committed site key makes authentication fail closed without it.

## Validation evidence

Local:

- `pnpm run setup --local-only --yes` — passed; added the Turnstile test secret
  to `.dev.vars`, migrated and seeded local D1, regenerated types, and ran the
  complete verification gate.
- `pnpm verify` after the documentation changes — passed: formatting, lint, 36
  maintained documents, Drizzle history, types, 43 Workers-runtime tests, one
  component test, 17 installer tests, import/database boundaries, and the
  production build.
- New runtime tests cover fail-closed configuration, `MISSING_RESPONSE` on all
  four protected endpoints with no user row or email created, limiter keys from
  `cf-connecting-ip`, the sanitized `429`, unlimited session reads, and the real
  `AUTH_LIMITER` binding.
- `pnpm smoke -- --url http://localhost:3000 --environment local` — passed,
  including the token-less sign-in rejection.
- Against `pnpm dev`, the smoke request plus nine further token-less sign-ins
  from one client returned `400`; the next three returned `429` with
  `Retry-After: 60`, confirming ten allowed requests per minute.
- The login page rendered the widget in dark mode and reported success with the
  test key; the sign-up form kept the flexible widget within a 375 px viewport.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=… pnpm test:e2e` — both browser journeys
  passed through the live test widget, covering sign-in, sign-up, password
  change, reset request, reset, and the invalid-token state.
- `pnpm cf:dry-run:production` — passed; 79 Worker modules with
  `env.AUTH_LIMITER (10 requests/60s)` and the production `TURNSTILE_SITE_KEY`.
- `pnpm cf:typegen` — idempotent.

Production (2026-09-25):

- Workers Build `a763606d` for merge commit `3ab15ae` deployed Worker version
  `aae32e59`. Its post-deploy smoke passed on the first attempt, including the
  token-less sign-in rejection.
- `pnpm smoke -- --environment production` passed independently at 09:00 UTC.
- A sign-in without a token returned `400 MISSING_RESPONSE`, and one with a
  forged token returned `403 VERIFICATION_FAILED` after a Siteverify call.
- The managed production widget rendered on `https://core.tanbase.dev/login`.
  It presented an interactive challenge to the automated browser, which was not
  solved.
- Operator-reported, after the email change deployed: sign-up, sign-in, and
  password reset succeeded through the solved production widget, proving the
  `TURNSTILE_SECRET_KEY` pairing and hostname pinning.

## Deployment state

| Target     | Commit                                | URL                        | Date                 | Result                                                                                                              |
| ---------- | ------------------------------------- | -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Local      | Working tree based on `a8d9100`       | `http://localhost:3000`    | 2026-09-24           | Setup, verify, smoke, burst, e2e, dry run passed                                                                    |
| Production | `3ab15ae` / Worker version `aae32e59` | `https://core.tanbase.dev` | 2026-09-25 09:00 UTC | Build `a763606d` post-deploy smoke with token-less rejection passed; forged token `403`; operator solved the widget |

## Rollback notes

Roll back the Worker version, then revert this change. The rate-limit binding
has no stored state and no data changes are involved. The Turnstile widget and
`TURNSTILE_SECRET_KEY` secret can remain; with the site key empty or the code
reverted they are unused.

## Remaining work

- Enable the restricted production `EMAIL` binding on `send.tanbase.dev` and
  prove one controlled delivery.
- Add `https://challenges.cloudflare.com` to the CSP in F-018.
- Consider keying IPv6 clients by `/64` prefix; each IPv6 address currently has
  its own bucket.
