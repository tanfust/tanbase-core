---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# 2026-09-25: Cached health check and privacy-first analytics

## Summary

Completed the F-018 implementation. The public health endpoint now caches a
successful D1 check for 30 seconds per Cloudflare location
([ADR-0009](../decisions/0009-public-health-endpoint.md)). PostHog analytics is
available as an opt-in, cookieless integration that loads only when the
`POSTHOG_KEY` Worker secret is set
([ADR-0010](../decisions/0010-privacy-first-analytics.md)). This PR also records
the production evidence for the security-headers change.

## Motivation

F-018 required the health endpoint to be protected or removed and PostHog to
load only when configured. The smoke suite and uptime monitors need a public
database-aware liveness check, and the template must not send analytics from
forks or leak auth tokens in page URLs.

## Behavior and configuration changes

- `createHealthResponse()` accepts a Workers Cache and key. The route stores a
  successful check in the `health` cache for 30 seconds under
  `/api/health/database-check` on the serving origin; failures are not cached.
  The JSON contract and `Cache-Control: no-store` are unchanged.
- `readAnalyticsConfig()` enables analytics only when `POSTHOG_KEY` is set and
  `POSTHOG_HOST` (default `https://us.i.posthog.com`) is an HTTPS origin.
- The root route loads that public configuration once per visit.
  `<Analytics />` dynamically imports the bundled `posthog-js` and initializes
  it with `cookieless_mode: "always"`, history-change page views, page leaves,
  and autocapture, session recording, surveys, feature flags, and external
  dependency loading disabled. A `before_send` hook strips query strings and
  fragments from all URL properties, and personal-data masking is on.
- The CSP adds `https://*.posthog.com`, or a proxy origin, to `connect-src` only
  when analytics is configured.
- Added pinned `posthog-js@1.434.0`, a release published more than a week
  earlier. Its `core-js` install script is explicitly denied in
  `pnpm-workspace.yaml`.

## Migrations and environment changes

No database migration or binding. Added the `POSTHOG_HOST` Wrangler variable,
empty in both environments, and regenerated Worker types. Analytics requires
the `POSTHOG_KEY` Worker secret and PostHog's "Cookieless server hash mode"
project setting; neither is configured by this change.

`node_modules` was relinked with the pinned pnpm 10.11.1 after a newer pnpm had
installed it. The lockfile change adds the PostHog packages and drops an
optional `supports-color` peer annotation from Babel entries; no existing
package version changed.

## Validation evidence

Local:

- `pnpm verify` — passed: formatting, lint, 41 maintained documents, Drizzle
  history, types, 54 Workers-runtime tests, one component test, 19 installer
  tests, import/database boundaries, and the production build.
- New runtime tests cover three health requests sharing one D1 query, failures
  never being cached, analytics staying off without a key or with a non-HTTPS
  host, host normalization, the CSP connect sources, and URL scrubbing that
  removes a reset token and an email address from event properties.
- The production client entry contains no PostHog code; the SDK is a separate
  95 KB gzipped chunk loaded only when configured.
- With a placeholder `POSTHOG_KEY` in `.dev.vars`, a production build served by
  `vite preview` sent `connect-src 'self' https://*.posthog.com`. In the
  browser, the SDK chunk loaded from the site origin and made one request, to
  `https://us.i.posthog.com/e/`; no PostHog script was injected, no cookie or
  `localStorage` entry was written, and navigation reported no CSP violations.
  The placeholder was removed and the build regenerated afterwards.
- `pnpm cf:dry-run:production` — passed; 84 Worker modules with
  `POSTHOG_HOST ("")`.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result                                          |
| ---------- | ------------------------------- | -------------------------- | ---------- | ----------------------------------------------- |
| Local      | Working tree based on `3fa7164` | `http://localhost:4291`    | 2026-09-25 | Verify, preview, browser checks, dry run passed |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed                                    |

## Rollback notes

Roll back the Worker version, then revert this change. Deleting the
`POSTHOG_KEY` secret turns analytics off without a deployment. The health cache
holds only a marker response and needs no cleanup.

## Remaining work

- To enable analytics on `core.tanbase.dev`: turn on PostHog's cookieless
  server hash mode, set `POSTHOG_HOST` for the project's region, and store
  `POSTHOG_KEY`.
- Record the production health and analytics evidence, then mark F-018 done.
