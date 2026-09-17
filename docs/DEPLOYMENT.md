---
status: active
audience: maintainers, operators, agents
last_verified: 2026-09-17
---

# Deployment runbook

Cloudflare Workers Builds owns every remote deployment. GitHub Actions verifies
the repository but never receives Cloudflare credentials and never deploys.

Preview and production builds select their Cloudflare environment during
`vite build`, because the Vite plugin emits flattened environment-specific
configuration at build time. Both configurations target the `tanbase-core`
Worker. Preview builds upload a new version without promoting it; production
builds deploy the active version.

## Required Cloudflare configuration

Connect the GitHub repository to the `tanbase-core` Worker, then open
**Settings > Build** and configure:

| Setting                              | Value                       |
| ------------------------------------ | --------------------------- |
| Production branch                    | `main`                      |
| Build command                        | `pnpm verify`               |
| Deploy command                       | `pnpm cf:deploy:production` |
| Non-production branch builds         | Enabled                     |
| Non-production branch deploy command | `pnpm cf:upload:preview`    |
| Root directory                       | Repository root             |

Cloudflare automatically creates and stores the Workers Builds API token. Do
not add `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` to GitHub for this
flow. Review the generated token's scope in Cloudflare and keep one consistent
token for this Worker.

Under **Settings > Domains & Routes**, keep Preview URLs enabled. Preview URLs
are public by default; use Cloudflare Access before putting private or customer
data in a preview environment.

## Local gates

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm cf:typegen
git diff --exit-code -- src/worker-configuration.d.ts
pnpm cf:dry-run:preview
pnpm cf:dry-run:production
```

The preview dry run uses `wrangler versions upload --dry-run`. The production
dry run uses `wrangler deploy --dry-run`. Neither changes remote state.

## Automated flow

For a non-production branch, Workers Builds:

1. Installs the pinned package manager and dependencies.
2. Runs `pnpm verify`.
3. Builds with `CLOUDFLARE_ENV=preview`.
4. Uploads an unpromoted version of `tanbase-core`.
5. Publishes the versioned preview URL in the build details and pull request.

For `main`, Workers Builds:

1. Installs dependencies and runs `pnpm verify`.
2. Builds with `CLOUDFLARE_ENV=production`.
3. Deploys the resulting version as the active production deployment.

Production deployment is automatic after a push to `main`; this topology has no
manual production approval gate. Protect `main` and require successful CI and
review before merge.

Do not enable a second remote deployment workflow in GitHub Actions. Two
deployment owners can race and make commit-to-deployment evidence ambiguous.

## Manual commands

These commands change Cloudflare state and are for recovery or explicit manual
operations, not the normal release path:

```sh
pnpm cf:upload:preview
pnpm cf:deploy:production
```

Cloudflare environment selection belongs inside those build commands. Do not
build once and attempt to switch the environment during upload or deployment.

## Smoke checks

Copy a branch preview URL from its Cloudflare build details or pull-request
comment, then run:

```sh
pnpm smoke -- --url <versioned-preview-url> --environment preview
pnpm smoke -- --url <production-url> --environment production
```

The script checks the exact health schema and environment, `Cache-Control:
no-store`, root SSR document HTML, head content, hydration scripts, and absence
of a server-error page.

After the first successful preview upload or production deployment, update
[status](STATUS.md) and the active
[change record](changes/2026-09-16-cloudflare-owned-deployments.md) with the
commit SHA, URL, UTC date, and smoke result. Keep each target separate.

## Rollback

Use Cloudflare's deployment rollback to restore the last known healthy active
version, then revert the faulty repository commit. Do not retry production from
an unverified local working tree. Record the rollback and repaired deployment.

If configuration or bindings changed, roll back code and configuration
together. A Worker rollback does not roll back data stored in connected
resources.

## Recovery

- Build failure: reproduce with `pnpm verify` and the environment-specific dry
  run, fix the branch, and push a new commit.
- Preview upload failure: inspect the Cloudflare build and Wrangler logs without
  copying tokens into an issue or change record.
- Preview smoke failure: leave the version unpromoted, fix the branch, and use
  the next generated preview URL.
- Production smoke failure: roll back to the last healthy deployment, revert or
  repair on a branch, and merge only after a new preview passes.
- Generated-type drift: run `pnpm cf:typegen`, review, and commit the result.

## Known limitation

Cloudflare does not generate preview URLs for Workers that implement Durable
Objects. Revisit ADR-0004 before implementing the Durable Objects roadmap slice;
do not silently remove preview coverage.

References: [TanStack Start on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/),
[Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
[build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/),
[preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/),
and [Cloudflare build environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/).
