---
status: active
audience: maintainers, operators, agents
last_verified: 2026-09-18
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
token for this Worker. It must also have the minimum D1 edit permission needed
to apply migrations from the repository deploy commands.

### D1 databases

Create `tanbase-core-preview` and `tanbase-core-production` in the same
Cloudflare account that owns the `tanbase-core` Worker. Bind each as `DB` in its
matching Wrangler environment and commit the resulting database IDs. Never bind
preview to production data, and do not run a remote migration while the target
account or database ID is unresolved.

Drizzle generates SQL under `drizzle/migrations/`, but only Wrangler applies it:

```sh
pnpm db:migrate:preview
pnpm db:migrate:production
```

The upload and deploy scripts run the matching migration command before code is
uploaded. Remote migrations must be backward-compatible with the currently
active Worker. Destructive changes require a later expand/contract rollout.

Under **Settings > Domains & Routes**, keep Preview URLs enabled. Preview URLs
are public by default; use Cloudflare Access before putting private or customer
data in a preview environment.

### Canonical production domain

Under **Settings > Domains & Routes**, add `tanbase-core.tanfust.com` as a custom
domain for the `tanbase-core` Worker. Cloudflare must provision the DNS route and
edge certificate before the production URL is considered available.

In the `tanfust.com` zone, create a hostname-scoped redirect rule for requests
whose scheme is HTTP and host is `tanbase-core.tanfust.com`. Redirect to the same
host over HTTPS while preserving the complete path and query string. Do not use
application middleware as a substitute for edge DNS, TLS, or redirect setup.

Confirm the redirect independently before the application smoke check:

```sh
curl --head http://tanbase-core.tanfust.com/
```

The response must be `301` or `308` with
`Location: https://tanbase-core.tanfust.com/`.

### Markdown for Agents

Markdown negotiation is configured on the `tanfust.com` Cloudflare zone, not in
Worker source or `wrangler.jsonc`. After the custom domain is active:

1. Confirm the zone is on a supported Pro, Business, or Enterprise plan.
2. Open **AI Crawl Control** for the zone.
3. Enable **Markdown for Agents**. If the setting should not apply zone-wide,
   create a Configuration Rule matching host `tanbase-core.tanfust.com` and set
   **Markdown for Agents** to **On**.
4. Run the production smoke command with `--expect-markdown`.

As of 2026-09-17, `tanfust.com` is on the Free plan and the dashboard exposes
Markdown for Agents as a disabled Pro feature. The HTML discovery baseline can
ship independently, but the Markdown gate must remain pending until the plan
and setting change.

Cloudflare must return Markdown only when `Accept: text/markdown` is requested,
include `Vary: Accept`, add the token-count headers, and preserve the origin
Content Signals policy. Do not add an application-side HTML converter as a
fallback; it would differ from the production edge behavior.

## Local gates

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm db:check
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
4. Applies pending migrations to `tanbase-core-preview`.
5. Uploads an unpromoted version of `tanbase-core`.
6. Publishes the versioned preview URL in the build details and pull request.

For `main`, Workers Builds:

1. Installs dependencies and runs `pnpm verify`.
2. Builds with `CLOUDFLARE_ENV=production`.
3. Applies pending additive migrations to `tanbase-core-production`.
4. Deploys the same verified commit as the active production deployment.

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
# Run only after Cloudflare Markdown for Agents is enabled:
pnpm smoke -- --url <production-url> --environment production --expect-markdown
```

The script checks the exact health schema, environment, and D1 check,
`Cache-Control: no-store`, root SSR document HTML, canonical metadata, discovery headers,
sitemap, environment-aware robots policy, truthful `llms.txt`, hydration
scripts, and absence of a server-error page. Cloudflare may prepend managed
training-bot groups to production `robots.txt`, so the smoke check validates the
application's exact wildcard group instead of rejecting unrelated bot-specific
blocks. The opt-in Markdown command additionally checks HTML-to-Markdown
negotiation, cache variation, token count, and Content Signals preservation.

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
