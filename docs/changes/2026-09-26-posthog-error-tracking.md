---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# 2026-09-26: PostHog Error Tracking with bundled capture and source maps

## Summary

PostHog now records uncaught browser errors for Error Tracking, and the
deploying Workers Build can upload the browser bundle's source maps
([ADR-0010 amendment](../decisions/0010-privacy-first-analytics.md#amendment-2026-09-26)).
The PostHog setup wizard proposed the change; this version makes capture
actually run under the CSP, keeps tokens out of error messages, and limits
uploads to the deploying build.

## Motivation

Production errors were invisible unless a user reported them. The wizard's
first version set `capture_exceptions: true`, but the SDK fetches the capture
code from PostHog's CDN, which `disable_external_dependency_loading` and the
CSP both block: in a browser test it recorded nothing. It also loaded `.env`
into every Vite build, so every local and `pnpm verify` build would have
uploaded source maps with a personal API key.

## Behavior and configuration changes

- `src/components/analytics.tsx` imports
  `posthog-js/dist/exception-autocapture` with the SDK and enables
  `capture_exceptions`.
- `src/modules/analytics/privacy.ts` strips query strings and fragments from
  URLs inside `$exception_list` messages and stack-frame filenames.
- `vite.config.ts` adds `@posthog/rollup-plugin` 1.6.1 for the client
  environment only, when `WORKERS_CI=1`, `CLOUDFLARE_ENV=production`,
  `POSTHOG_API_KEY`, and `POSTHOG_PROJECT_ID` are all set. It emits hidden
  source maps, uploads them with `POSTHOG_CLI_HOST`, and deletes them.
- `.gitignore` ignores `.env`.

## Migrations and environment changes

No migrations, bindings, or Worker variables. Source-map upload needs three
Workers Builds build variables, `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, and
`POSTHOG_CLI_HOST`, described in the
[deployment runbook](../DEPLOYMENT.md#required-cloudflare-configuration).
Without them, deploys proceed without uploading.

## Validation evidence

Local:

- `src/platform/analytics.test.ts` — 7 tests, including exception messages and
  frames with absolute and relative URLs, and prose that only looks like a
  query.
- Browser, on a page without the app's own PostHog instance, with a fake key,
  an unresolvable `api_host`, and a `before_send` that dropped every event:
  without the bundled extension, a thrown error produced no event; with it, a
  `$exception` event whose message kept `/reset-password` and lost
  `?token=abc123`.
- `pnpm verify` and the production dry run — see the pull request.

Production: pending deployment and the Workers Builds variables.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result  |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------- |
| Local      | Working tree based on `9e695ab` | `http://localhost:3000`    | 2026-09-26 | Passed  |
| Production | —                               | `https://core.tanbase.dev` | —          | Pending |

## Rollback notes

Revert the change. Removing `POSTHOG_API_KEY` from Workers Builds alone stops
uploads; removing the `POSTHOG_KEY` Worker secret turns analytics off.

## Remaining work

- Operator: add the three Workers Builds variables, deploy, and confirm a
  symbol set for the deployed commit and a readable test exception in PostHog.
