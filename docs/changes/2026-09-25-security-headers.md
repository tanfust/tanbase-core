---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# 2026-09-25: Security headers, error pages, and request logging

## Summary

First F-018 hardening slice. Added security headers with a per-response nonce
Content Security Policy, static-asset headers and immutable caching, root error
and not-found pages, and structured logging that carries the Cloudflare Ray ID
as a request ID. The production smoke suite now enforces the headers and the
nonce on every inline script.

## Motivation

The production site accepts public sign-ups but sent no CSP, HSTS, framing,
MIME-sniffing, or referrer protection. Server errors and not-found routes used
placeholder markup, and logs could not be correlated with a request.

## Behavior and configuration changes

- `src/server.ts` creates a request ID (the `cf-ray` value, or a UUID) and a
  random nonce, runs the request inside an `AsyncLocalStorage` context, logs
  unhandled errors as `request.failed` with a generic `500` response, and adds
  `X-Request-Id` and the security headers. WebSocket upgrade responses pass
  through unchanged.
- Documents receive a CSP allowing scripts only from `'self'`, the request
  nonce, and `https://challenges.cloudflare.com`, which is also the only
  allowed frame. The policy forbids framing, plugins, and cross-origin form
  targets and upgrades insecure requests in production. The Vite dev server has
  no CSP.
- The router receives the nonce through `ssr.nonce`, so its SSR scripts carry
  it. The theme script moved to `ScriptOnce`, which carries the nonce and
  removes itself before hydration.
- Every Worker response sends `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy`;
  production adds HSTS. `public/_headers` gives static assets the same
  baseline plus immutable caching for fingerprinted `/assets/*`.
- The root route renders branded not-found and error pages; the error page
  offers a retry and shows the error message only in development.
- `src/platform/log.ts` writes structured objects with the request ID. The
  email module and Better Auth now log through it; Better Auth entries forward
  only the level, message, and error messages.
- The smoke suite asserts the baseline headers and a request ID everywhere, and
  in production asserts HSTS, the nonce CSP, the nonce on every inline script,
  and immutable, `nosniff` fingerprinted assets.

## Migrations and environment changes

No database migration, binding, variable, or secret changed. Added
`public/_headers`. No generated Worker types changed.

## Validation evidence

Local:

- `pnpm verify` — passed: formatting, lint, 38 maintained documents, Drizzle
  history, types, 48 Workers-runtime tests, one component test, 19 installer
  tests, import/database boundaries, and the production build.
- New runtime tests cover nonce randomness and format, the policy directives,
  header application that preserves status, body, and existing headers, the
  CSP limited to documents, HSTS limited to production, and request IDs in log
  entries inside and outside a request.
- The client bundle contains no `AsyncLocalStorage` or request-context code;
  import protection passed.
- `pnpm build` then `vite preview` on port 4291 served the production build with
  every header, and all four scripts on `/` (the theme script, the router
  stream barrier, the module entry, and the closing router script) carried the
  nonce from the CSP. A fingerprinted asset returned `immutable`, HSTS, and
  `nosniff` from `_headers`.
- In the browser against that build, the login page hydrated, applied the
  saved dark theme, rendered the Turnstile test widget, and issued a token;
  client-side navigation to sign-up loaded without CSP violations; and an
  unknown path rendered the new not-found page.
- `pnpm cf:dry-run:production` — passed; 81 Worker modules.

Production (2026-09-25):

- Workers Build `927894c6` for merge commit `3fa7164` deployed Worker version
  `c38f520e`; its post-deploy smoke passed on the first attempt with the new
  header, nonce, and asset assertions.
- `pnpm smoke -- --environment production` passed independently at 10:30 UTC.
- In the browser on `https://core.tanbase.dev`, the homepage hydrated, the
  client-side navigation to `/login` rendered the Turnstile container, and no
  CSP violations were reported.

## Deployment state

| Target     | Commit                                | URL                        | Date                 | Result                                              |
| ---------- | ------------------------------------- | -------------------------- | -------------------- | --------------------------------------------------- |
| Local      | Working tree based on `6015166`       | `http://localhost:4291`    | 2026-09-25           | Verify, preview CSP, browser checks, dry run passed |
| Production | `3fa7164` / Worker version `c38f520e` | `https://core.tanbase.dev` | 2026-09-25 10:30 UTC | Post-deploy smoke and live CSP browser check passed |

## Rollback notes

Roll back the Worker version if the policy blocks a resource, then revert this
change. No data changes are involved. Removing `public/_headers` restores
Cloudflare's default asset headers.

## Remaining work

- The cached health check and PostHog are delivered by the following change.
- Consider CSP violation reporting once a reporting endpoint exists.
