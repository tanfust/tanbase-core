---
status: active
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
- Establishes a Prettier baseline and keeps registry-generated UI components
  under narrowly scoped ESLint compatibility rules.

## Migrations and environment changes

There are no data migrations and no Cloudflare bindings in this slice. GitHub
maintainers must create `preview` and protected `production` environments, then
configure `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `APP_URL` as
described in the [deployment runbook](../DEPLOYMENT.md).

`src/worker-configuration.d.ts` is generated from `wrangler.jsonc` and committed.

## Validation evidence

Local evidence:

- `pnpm install --frozen-lockfile --trust-lockfile` — passed.
- `pnpm cf:typegen` — passed; generated runtime and `APP_ENV` types.
- `pnpm verify` — passed formatting, lint, docs, TypeScript, four tests, the
  deliberate import-protection failure, and the default Worker build.
- `pnpm cf:dry-run:preview` — passed with Worker `tanbase-core-preview` and
  `APP_ENV=preview`.
- `pnpm cf:dry-run:production` — passed with Worker `tanbase-core` and
  `APP_ENV=production`.
- `pnpm smoke -- --url http://localhost:3004 --environment local` — passed. The
  development server selected 3004 because ports 3000 through 3003 were already
  occupied; those unrelated processes were not stopped.

Preview evidence:

- `pnpm cf:deploy:preview` — deployed successfully at 2026-09-16 21:05 UTC.
- `pnpm smoke -- --url https://tanbase-core-preview.tanfust.workers.dev --environment preview`
  — passed the exact health and SSR contract.

Production evidence: not run. Local and preview success do not authorize or
represent a production deployment.

## Deployment state

| Target     | Commit                                   | URL                                                | Date                 | Result                                                                  |
| ---------- | ---------------------------------------- | -------------------------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| Local      | Uncommitted tree based on `2522a336f0bd` | `http://localhost:3004`                            | 2026-09-16 21:03 UTC | Verify and smoke passed                                                 |
| Preview    | Same tree based on `2522a336f0bd`        | `https://tanbase-core-preview.tanfust.workers.dev` | 2026-09-16 21:05 UTC | Deploy and smoke passed; version `7dd0dc57-8002-48c4-8fe8-f501fbc48067` |
| Production | Not deployed                             | Not assigned                                       | —                    | Not run; manual approval required                                       |

## Rollback notes

Before remote deployment, revert this change as a unit. After deployment, use a
Cloudflare deployment rollback for immediate recovery, revert the repository
change, then require preview verification before approving production again.

## Remaining work

- Commit the verified working tree so automation can promote one exact commit.
- Configure the GitHub `preview` and protected `production` environments.
- Deploy production only after the protected environment approval.
- Add D1 as the next product-backed vertical slice.
