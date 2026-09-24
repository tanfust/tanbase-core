---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-24
---

# 2026-09-24: Canonical origin on core.tanbase.dev

## Summary

Moved the canonical production origin from `https://tanbase-core.tanfust.com` to
`https://core.tanbase.dev`, made the deploy command run the production smoke
suite after every deployment, and corrected stale production facts in the
active documentation.

## Motivation

The project now owns `tanbase.dev`. The Better Auth URL, Turnstile hostname, and
email sender domain must bind to the final hostname before F-006 and email
delivery are configured, or each would have to be redone.

A production audit on 2026-09-24 also found that Workers Builds had deployed
`fcdee3c` without a `BETTER_AUTH_SECRET`, so `/app` and `/api/auth/*` returned
HTTP 500 and the production smoke suite failed. Nothing reported it, because the
deploy command did not run smoke, and the status snapshot still described an
older deployment.

## Behavior and configuration changes

- `siteConfig.origin`, `llms.txt`, and the production `BETTER_AUTH_URL` now use
  `https://core.tanbase.dev`; Worker types were regenerated.
- `pnpm cf:deploy:production` ends with `scripts/smoke-after-deploy.mjs`, which
  runs the production smoke suite against the canonical origin with up to three
  attempts 15 seconds apart. A failure fails the Workers Build but does not roll
  back the deployment.
- `pnpm smoke` no longer requires `--url` for production and defaults to the
  canonical origin; local runs still require it.
- Added [ADR-0008](../decisions/0008-canonical-production-domain.md) and updated
  the status, deployment, discovery, overview, and development guides.

## Migrations and environment changes

No database migration, binding, or secret changed. The production
`BETTER_AUTH_URL` variable changed and `src/worker-configuration.d.ts` was
regenerated.

Operator actions:

- Before merge: set the production `BETTER_AUTH_SECRET` (done 2026-09-24 19:24
  UTC, Worker version `dfc781da`). Enable **Always Use HTTPS** on the
  `tanbase.dev` zone, add proxied `AAAA 100::` records for `tanbase.dev` and
  `www.tanbase.dev`, and add the temporary `302` apex and `www` redirect rule.
- Immediately after the deployment, the former hostname was retired instead of
  redirected: the operator removed `tanbase-core.tanfust.com` from the Worker,
  which deleted its DNS record. The planned `301` rule was not added; see the
  [ADR-0008 amendment](../decisions/0008-canonical-production-domain.md#amendment-2026-09-24).

## Validation evidence

Production, before this change:

- `pnpm smoke -- --url https://tanbase-core.tanfust.com --environment production`
  failed with `protected app must redirect without a session, got 500`, and
  `wrangler secret list --env production` returned `[]`.
- After the operator set `BETTER_AUTH_SECRET`, the same command passed at
  2026-09-24 19:27 UTC against Worker version `dfc781da`.
- `wrangler d1 migrations list DB --env production --remote` reported no pending
  migrations.

`tanbase.dev` zone, before merge (verified 2026-09-24 20:01 UTC):

- The zone API reports Always Use HTTPS `on`, proxied `AAAA 100::` records for
  `tanbase.dev` and `www.tanbase.dev`, and one redirect rule
  `(http.host in {"tanbase.dev" "www.tanbase.dev"})` with a dynamic `302` target
  `concat("https://core.tanbase.dev", http.request.uri.path)` and the query
  string preserved.
- `curl` returned `302` from `https://tanbase.dev/docs/x?a=1&b=2` to
  `https://core.tanbase.dev/docs/x?a=1&b=2`, and from
  `https://www.tanbase.dev/login?redirect=%2Fapp` to
  `https://core.tanbase.dev/login?redirect=%2Fapp`. HTTP apex and `www`
  requests reach the canonical origin in one hop.
- `curl` returned `301` from `http://core.tanbase.dev/login?redirect=%2Fapp` to
  the same HTTPS URL; `https://core.tanbase.dev/` returned `200`.

Former hostname, after the deployment (verified 2026-09-24 20:46 UTC):

- The Worker's only custom domain is `core.tanbase.dev`; the `tanfust.com` zone
  has no record for `tanbase-core.tanfust.com`, `dig` returns no address, and
  `curl https://tanbase-core.tanfust.com/` cannot resolve the host.
- Before it was removed, a sign-in `POST` with that origin returned `403`,
  confirming the former hostname could no longer authenticate users.

Local:

- `pnpm verify` — passed: formatting, lint, 35 maintained documents, Drizzle
  history, types, 37 Workers-runtime tests, one component test, 15 installer
  tests, import/database boundaries, and the production build.
- `pnpm cf:dry-run:production` — passed; 74 Worker modules packaged with
  `BETTER_AUTH_URL ("https://core.tanbase.dev")` and production D1.
- `pnpm cf:typegen` — regeneration left `src/worker-configuration.d.ts`
  unchanged beyond the intended `BETTER_AUTH_URL` update.
- `pnpm smoke -- --url http://localhost:3000 --environment local` — passed.
- `node scripts/smoke.mjs --environment local` without `--url` exits with the
  usage message, as intended.

## Deployment state

| Target     | Commit                                | URL                        | Date                 | Result                                                                                           |
| ---------- | ------------------------------------- | -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| Local      | Working tree based on `fcdee3c`       | `http://localhost:3000`    | 2026-09-24           | Verify, dry run, typegen, and smoke passed                                                       |
| Production | `0c6ea5a` / Worker version `b469d461` | `https://core.tanbase.dev` | 2026-09-24 20:08 UTC | Workers Build `fbf5f087` post-deploy smoke passed on the first attempt; independent smoke passed |

## Rollback notes

Roll back the Worker to the previous version in Cloudflare, re-attach
`tanbase-core.tanfust.com` as a Worker custom domain, then revert this change so
the canonical origin and `BETTER_AUTH_URL` return to the former hostname
together.
The apex redirect and Always Use HTTPS are independent and can remain. No data
change is involved.

## Remaining work

- Enable GitHub branch protection on `main` with required CI.
- F-006 Turnstile and auth rate limits, then the restricted production `EMAIL`
  binding and `EMAIL_FROM` on the onboarded `send.tanbase.dev` sender domain
  and one controlled production delivery.
