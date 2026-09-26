---
status: active
audience: contributors, maintainers, product, agents
last_verified: 2026-09-27
---

# 2026-09-27: Narrow the roadmap to the launch path

## Summary

The roadmap drops app-level features and the 30-day cost report, and puts
demo guardrails after launch. The remaining build order is F-020, F-021,
F-023, F-017, F-019, F-024, and then F-022. The landing page no longer
promises a published invoice.

## Motivation

The task board exists to exercise each Cloudflare primitive a real app needs,
not to become a complete product. The operator decided on 2026-09-27 that:

- Magic link and Google sign-in (F-009), drag ordering (F-008), and the daily
  digest (F-026) are app features for forks to add.
- The 30-day cost report (F-025) will not be published.
- Demo guardrails (F-022) follow launch.
- OG images (F-017) and performance budgets (F-019) land before launch.

The live landing page and OVERVIEW still promised the invoice report, so
leaving them would state a plan that no longer exists.

## Behavior and configuration changes

- `docs/FEATURES.md` marks F-008, F-009, F-025, and F-026 as ⛔ Dropped, each
  with a one-line reason, and keeps their IDs. It adds a "Remaining work"
  build order and a legend entry for Dropped. F-024 now depends on F-017 and
  F-019 instead of F-022. F-017, F-019, F-020, F-021, and F-023 are P0,
  because they block launch. F-022 is P1 and depends on F-024. F-024 checks
  its MIT license and public-repository criteria, which are already true.
- `docs/OVERVIEW.md` replaces the invoice promise with the stated target and
  guardrails. It lists the guardrails that run now and the ones F-022 adds
  after launch, drops the invoice success criterion and differentiator, and
  lists app features beyond the primitives as out of scope.
- The landing page and its Markdown representation drop the "Planned" line
  about publishing the invoice, from `src/modules/seo/homepage.ts` and
  `src/routes/index.tsx`.

## Migrations and environment changes

None.

## Validation evidence

Local:

- `src/modules/seo/negotiation.test.ts` asserts the homepage Markdown no
  longer mentions an invoice.
- `pnpm verify` steps without `.dev.vars`: 175 Worker, 21 UI, 23 setup, and 6
  script tests passed, with format, lint, docs, schema, types, boundaries, and
  build.
- `pnpm cf:dry-run:production` — passed.
- `pnpm smoke -- --url http://localhost:4391 --environment local` against
  `vite build` plus `vite preview` — passed. The page and its Markdown contain
  no "invoice" or "Planned" text, and the cost section renders with the
  allowances, risks, and guardrails.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result       |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------------ |
| Local      | Working tree based on `3b755bd` | `http://localhost:4391`    | 2026-09-27 | Passed       |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the change. The dropped entries keep their IDs, so restoring a feature
means setting its status back to Todo and restoring its criteria from git
history.

## Remaining work

The remaining build order in `docs/FEATURES.md`, starting with F-020.
