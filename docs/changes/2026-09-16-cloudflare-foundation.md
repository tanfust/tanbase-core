---
status: in-progress
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-16
---

# 2026-09-16: Cloudflare foundation

## Summary

Adds the documentation standard and the smallest real Cloudflare Workers
foundation for TanStack Start SSR and static assets.

## Motivation

TanBase Core needs a verified deployment architecture before data or service
bindings are added. It also needs durable context that future developers and AI
agents can use without confusing historical implementation notes with current
truth.

## Behavior and configuration changes

- Pins direct dependencies, pnpm, and supported Node lines.
- Runs the Cloudflare Vite plugin before TanStack Start and retains the existing
  Tailwind and React ordering.
- Adds explicit SSR configuration and a custom Worker entry.
- Adds isolated Worker environments, observability, and `APP_ENV`.
- Adds the public, non-cached `GET /api/health` foundation contract.
- Adds verification, type generation, environment builds, dry runs, deployments,
  smoke checks, and a negative server-only import test.
- Adds CI and preview-first, manually approved production workflows.
- Establishes maintained docs, ADRs, change records, and agent context.

## Migrations and environment changes

There are no data migrations and no Cloudflare bindings in this slice. GitHub
maintainers must create `preview` and protected `production` environments, then
configure `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `APP_URL` as
described in the [deployment runbook](../DEPLOYMENT.md).

`src/worker-configuration.d.ts` is generated from `wrangler.jsonc` and committed.

## Validation evidence

Evidence will be updated after the final local and dry-run suite. A successful
local result will not be recorded as a preview or production deployment.

## Deployment state

| Target     | Commit       | URL                     | Date       | Result                            |
| ---------- | ------------ | ----------------------- | ---------- | --------------------------------- |
| Local      | Pending      | `http://localhost:3000` | 2026-09-16 | Final suite pending               |
| Preview    | Not deployed | Not assigned            | —          | Not run                           |
| Production | Not deployed | Not assigned            | —          | Not run; manual approval required |

## Rollback notes

Before remote deployment, revert this change as a unit. After deployment, use a
Cloudflare deployment rollback for immediate recovery, revert the repository
change, then require preview verification before approving production again.

## Remaining work

- Complete and record local verification and both environment dry runs.
- Deploy and smoke preview when Cloudflare credentials are available.
- Deploy production only after the protected environment approval.
- Add D1 as the next product-backed vertical slice.
