---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-18
---

# 2026-09-16: Cloudflare-owned deployments

## Summary

Moves remote deployment ownership from GitHub Actions to Cloudflare Workers
Builds and replaces the separate preview Worker with versioned previews of the
`tanbase-core` Worker.

## Motivation

The repository is already connected to Cloudflare. Using that integration as
the only deployment system avoids duplicate deployments and removes the need
to store Cloudflare deployment credentials in GitHub.

## Behavior and configuration changes

- Removes the GitHub deployment workflow; credential-free GitHub CI remains.
- Targets `tanbase-core` from both preview and production Vite builds.
- Enables Worker preview URLs explicitly.
- Adds `pnpm cf:upload:preview` for unpromoted Worker versions.
- Uses `wrangler versions upload --dry-run` for the preview packaging gate.
- Supersedes ADR-0002 with the Cloudflare-owned deployment decision.
- Updates the active feature, development, deployment, and status documents.

## Migrations and environment changes

There are no data migrations or new runtime bindings. In the Cloudflare Worker,
`main` is the production branch, non-production branch builds are enabled, and
the commands from the deployment runbook are saved. Version preview URLs are
enabled. The production `workers.dev` URL remains disabled until a production
release is intentionally made public.

GitHub does not need `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, deployment
environments, or deployment URL variables for this flow.

## Validation evidence

Local evidence:

- `pnpm cf:typegen` — passed; the committed Worker types did not change.
- `pnpm verify` — passed formatting, lint, documentation checks, TypeScript,
  four tests, the deliberate import-protection failure, and the default build.
- `pnpm cf:dry-run:preview` — passed using `wrangler versions upload --dry-run`;
  the flattened configuration targets `tanbase-core` with `APP_ENV=preview`.
- `pnpm cf:dry-run:production` — passed using `wrangler deploy --dry-run`; the
  flattened configuration targets `tanbase-core` with `APP_ENV=production`.

Wrangler could not write its optional debug log outside the workspace sandbox,
but each command completed with exit code 0.

Cloudflare dashboard evidence:

- Git repository: `tanfust/tanbase-core`.
- Production branch: `main`.
- Build command: `pnpm verify`.
- Production deploy command: `pnpm cf:deploy:production`.
- Non-production version command: `pnpm cf:upload:preview`.
- Non-production branch builds and version preview URLs: enabled.

Preview evidence: `pnpm cf:upload:preview` was attempted on 2026-09-18 from
commit `d6a81bc32d0d79b6b56dd835ebbe0ee9446bb081`. Wrangler returned “You cannot
upload a new version of a Worker that does not yet exist” and generated no URL.
Account inventory checks confirmed that neither accessible Cloudflare account
contains `tanbase-core`, so the preview smoke could not run. This remains a
failed gate, not preview evidence.

Production evidence: not run. A local dry run is not a production deployment.

## Deployment state

| Target     | Commit                               | URL        | Date                 | Result                          |
| ---------- | ------------------------------------ | ---------- | -------------------- | ------------------------------- |
| Local      | Working tree based on `4cb88ea7bf4f` | Local only | 2026-09-16 21:43 UTC | Verify and both dry runs passed |
| Preview    | `d6a81bc32d0d79`                     | No URL     | 2026-09-18           | Blocked: target Worker missing  |
| Production | —                                    | —          | —                    | Not deployed                    |

## Rollback notes

Restore the GitHub deployment workflow and the separate preview Worker
configuration only together, then reconfigure the protected GitHub environments
before allowing GitHub to deploy. Disable Cloudflare automatic deployments
first so that two deployment owners cannot race.

## Remaining work

- Push a non-production branch and smoke its generated preview URL.
- Merge a verified commit to `main` and smoke the production URL.
- Reconsider preview topology before the Durable Objects feature.
