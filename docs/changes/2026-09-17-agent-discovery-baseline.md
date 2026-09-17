---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-17
---

# 2026-09-17: Authentic agent discovery baseline

## Summary

Adds the first truthful public discovery surface for the canonical TanBase Core
origin without advertising unimplemented APIs, authentication, MCP, skills, or
other agent capabilities.

## Motivation

The readiness review found no sitemap, no discovery links, no Content Signals,
and no deployed `llms.txt`. Several additional scanner recommendations require
product capabilities that do not exist yet. This slice implements the useful
baseline and records explicit gates for the rest.

## Behavior and configuration changes

- Sets `https://tanbase-core.tanfust.com` as the canonical production origin.
- Adds `/sitemap.xml`, environment-aware `/robots.txt`, and `/llms.txt` server
  routes with a five-minute public cache policy.
- Keeps the `llms.txt` source inside the SEO module so Vite development and the
  deployed Worker both serve the public root URL through the same route.
- Lists only the public homepage in the sitemap.
- Allows production crawling while local and preview environments remain
  blocked from indexing.
- Adds truthful homepage discovery links and the selected Content Signals
  policy without buffering the streamed SSR response. The headers use the
  registered `describedby` and `related` relations; sitemap discovery also uses
  the standard `robots.txt` directive.
- Extends unit and smoke coverage for the complete discovery contract.
- Documents current resources and gates future discovery metadata on real
  product capabilities.

## Migrations and environment changes

No data migrations, secrets, Worker bindings, or Wrangler variables are added.
`src/worker-configuration.d.ts` does not require regeneration for this change.

Operators must attach `tanbase-core.tanfust.com` to the production Worker and
configure a hostname-scoped HTTP-to-HTTPS redirect in Cloudflare before live
verification.

## Validation evidence

Local evidence:

- `pnpm verify` — passed formatting, lint, documentation checks, TypeScript, 13
  tests, the deliberate import-protection failure, and the default Worker build.
- `pnpm smoke -- --url http://localhost:3005 --environment local` — passed the
  health, SSR, canonical metadata, discovery header, sitemap, non-production
  robots, and `llms.txt` contracts.
- `WRANGLER_LOG_PATH=/private/tmp/tanbase-core-wrangler-preview.log pnpm cf:dry-run:preview`
  — passed and emitted `APP_ENV=preview`.
- `WRANGLER_LOG_PATH=/private/tmp/tanbase-core-wrangler-production.log pnpm cf:dry-run:production`
  — passed and emitted `APP_ENV=production`.
- `pnpm preview` followed by
  `pnpm smoke -- --url http://localhost:4181 --environment production` — passed
  against the locally built production Worker configuration.
- `curl -I --max-time 15 https://tanbase-core.tanfust.com/` — failed with
  `Could not resolve host` in both the restricted and unrestricted host checks.

At initial validation, preview and production deployment were not run. The local
production-mode smoke proved the built behavior, not a remote deployment.

Post-deployment evidence added on 2026-09-17:

- Cloudflare Workers Builds deployed commit `efd9161` as active Worker version
  `d91d365d`.
- `tanbase-core.tanfust.com` was attached as the production custom domain.
- HTTP returned `301` to the exact HTTPS root; HTTPS returned the Worker SSR
  document with a valid edge connection.
- `pnpm smoke -- --url https://tanbase-core.tanfust.com --environment production`
  passed after the smoke assertion was corrected to distinguish Cloudflare's
  managed training-bot groups from the application's crawlable wildcard group.
- Markdown negotiation remained outside this baseline and is tracked in the
  follow-up change record.

## Deployment state

| Target     | Commit                          | URL                                | Date                 | Result                                    |
| ---------- | ------------------------------- | ---------------------------------- | -------------------- | ----------------------------------------- |
| Local      | Working tree based on `819ddcd` | Local only                         | 2026-09-17           | Verify, dry runs, and smoke checks passed |
| Preview    | —                               | —                                  | —                    | Not uploaded                              |
| Production | `efd9161` / version `d91d365d`  | `https://tanbase-core.tanfust.com` | 2026-09-17 16:42 UTC | HTML discovery smoke passed               |

## Rollback notes

Revert the discovery routes, response decorator, site configuration, tests, and
documentation together. Restore the static robots file only if the dynamic
environment policy is also removed.

## Remaining work

- Enable Markdown for Agents at the Cloudflare zone edge and pass production
  smoke with `--expect-markdown`.
- Upload and smoke a branch preview, then deploy and smoke the reviewed commit.
- Complete the remaining F-016 landing-page, SEO helper, noindex, and JSON-LD
  acceptance criteria.
- Revisit each deferred discovery capability only when its backing product
  feature exists.
