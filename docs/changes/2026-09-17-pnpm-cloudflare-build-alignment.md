---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-17
---

# 2026-09-17: Align pnpm with Cloudflare Workers Builds

## Summary

Aligns local development, GitHub CI, and Cloudflare Workers Builds on pnpm
10.11.1 and restores ordinary frozen-lockfile installation without a supply-chain
policy bypass.

## Motivation

The first Git-connected production build for commit `d057fe5c80b1` failed in
Cloudflare's automatic dependency-install phase. The repository pinned pnpm
12.4.1, whose default 24-hour `minimumReleaseAge` verification rejected 21 new
lockfile entries. The working `tanfust` Worker uses Cloudflare's default pnpm
10.11.1 and completes the same automatic `pnpm install --frozen-lockfile` phase.

The earlier local and GitHub commands included `--trust-lockfile`, which bypassed
the verification and hid the mismatch. That bypass is unsuitable as the default
for a public repository where contributors can modify the lockfile.

## Behavior and configuration changes

- Pins pnpm 10.11.1 in `package.json` and GitHub CI.
- Uses `pnpm install --frozen-lockfile` consistently in public instructions and
  CI.
- Adds `onlyBuiltDependencies` for pnpm 10.11 while retaining the equivalent
  `allowBuilds` map for newer pnpm versions.
- Keeps Cloudflare's automatic install and existing `pnpm verify` build command.
- Does not add `SKIP_DEPENDENCY_INSTALL`, a custom install command, or a
  lockfile-trust bypass.

## Migrations and environment changes

No data, binding, secret, or Cloudflare dashboard variable changes are required.
Cloudflare should detect pnpm 10.11.1 from `packageManager` on the next build.

## Validation evidence

Cloudflare failure evidence:

- Build `85e04e4a` for `d057fe5c80b1` detected pnpm 12.4.1 and Node 24.18.0.
- Its automatic `pnpm install --frozen-lockfile` failed with
  `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` before `pnpm verify` ran.
- The successful `tanfust` build `e76c6dbe` detected pnpm 10.11.1 and completed
  Cloudflare's automatic frozen install, build, and deployment.

Local evidence using pnpm 10.11.1:

- `pnpm install --frozen-lockfile` — passed with 708 packages and the approved
  `esbuild`, `unrs-resolver`, and `workerd` install scripts.
- `pnpm verify` — passed formatting, lint, documentation checks, TypeScript,
  four tests, the deliberate import-protection failure, and the default build.
- `pnpm cf:typegen` plus the generated-file diff check — passed with no drift.
- `pnpm cf:dry-run:preview` — passed and emitted `APP_ENV=preview`.
- `pnpm cf:dry-run:production` — passed and emitted `APP_ENV=production`.

Preview evidence: not run. No preview deployment is claimed.

Production evidence: the failed install created no production deployment.

## Deployment state

| Target     | Commit                               | URL        | Date                 | Result                                        |
| ---------- | ------------------------------------ | ---------- | -------------------- | --------------------------------------------- |
| Local      | Working tree based on `d057fe5c80b1` | Local only | 2026-09-17           | Install, verify, typegen, and dry runs passed |
| Preview    | —                                    | —          | —                    | Not uploaded                                  |
| Production | `d057fe5c80b1`                       | —          | 2026-09-16 22:49 UTC | Install failed before build and deployment    |

## Rollback notes

Revert the pnpm pin and dual build-approval configuration together. Do not
restore `--trust-lockfile` without an explicit security decision for public
contributions.

## Remaining work

- Push the correction and confirm Cloudflare detects pnpm 10.11.1.
- Smoke the resulting production deployment and record its commit, URL, date,
  and result separately from local evidence.
