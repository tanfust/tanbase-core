---
status: active
audience: maintainers, operators, agents
last_verified: 2026-09-20
---

# Deployment runbook

Cloudflare Workers Builds owns production deployment. GitHub Actions verifies
the repository but never receives Cloudflare credentials and never deploys.

The base Wrangler configuration is local-only. Production builds select the
`production` Cloudflare environment during `vite build`, because the Vite plugin
emits flattened environment-specific configuration at build time.

For a fresh clone, prefer the resumable [guided installer](INSTALLING.md):

```sh
pnpm run setup
```

It resolves the account, provisions D1, applies migrations before code,
configures the Better Auth secret without persisting it, deploys, and runs the
production smoke suite. The manual sections below remain the recovery contract.

## Required Cloudflare configuration

Connect the GitHub repository to the `tanbase-core` Worker, then configure:

| Setting                      | Value                       |
| ---------------------------- | --------------------------- |
| Production branch            | `main`                      |
| Build command                | `pnpm verify`               |
| Deploy command               | `pnpm cf:deploy:production` |
| Non-production branch builds | Disabled                    |
| Root directory               | Repository root             |

Cloudflare automatically creates the Workers Builds API token. Do not add
`CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` to GitHub. The generated token
must have the minimum D1 edit permission needed by the deploy command.

Keep Preview URLs disabled. The active production `workers.dev` route is a
separate setting and may remain enabled.

### Production D1 database

Create `tanbase-core-production` in the account that owns the `tanbase-core`
Worker. Bind it as `DB` in the `production` Wrangler environment and commit its
exact database ID. Do not run a remote command while the account or ID is
unresolved.

Drizzle generates SQL under `drizzle/migrations/`, but only Wrangler applies it:

```sh
pnpm db:migrate:production
```

`pnpm cf:deploy:production` builds first, applies pending production migrations,
then deploys the generated Worker. Migrations must remain compatible with the
currently active code; destructive changes require an expand/contract rollout.

### Better Auth

The production URL is committed as `BETTER_AUTH_URL`; the secret is not. Create
a unique production secret of at least 32 characters and store it as the
Worker secret `BETTER_AUTH_SECRET` in Cloudflare. For a manual setup:

```sh
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
```

Do not place the secret in `wrangler.jsonc`, Workers Builds variables, source,
documentation, or logs. Better Auth stores users, accounts, sessions, and
verification records in D1. No KV namespace is required for auth; the reason is
recorded in [ADR-0006](decisions/0006-d1-auth-session-storage.md).

Apply the auth migration before deploying the code. Do not make the auth UI
public until transactional email delivery, Turnstile, and the auth rate limit
have passed their own production checks.

### Transactional email

The email module can use the native `EMAIL` binding and needs no provider API
key. The binding is omitted by default so a fresh Free account can deploy. While
`EMAIL_FROM` is empty, the module records only non-sensitive delivery metadata
and does not send. To enable production email:

1. Confirm the account is on Workers Paid; arbitrary outbound recipients are
   not available on the Free plan.
2. Onboard the sending domain in Cloudflare Email Service and confirm its SPF
   and DKIM records are active.
3. Add the production `send_email` binding named `EMAIL`.
4. Set the production `EMAIL_FROM` Wrangler variable to a sender on that domain.
5. Restrict the production `send_email` binding with
   `allowed_sender_addresses` after the exact sender is known.
6. Regenerate Worker types, run verification and the production dry run, then
   deploy the same verified commit.

The authenticated operator can inspect onboarding with:

```sh
pnpm exec wrangler email sending list
pnpm exec wrangler email sending settings <domain>
```

Email Sending is a beta transactional service. Verify one delivery to an
address controlled by the operator before enabling authentication emails. Do
not use it for newsletters or bulk marketing.

### Canonical production domain

Attach `tanbase-core.tanfust.com` to the production Worker. Cloudflare must
provision DNS and the edge certificate before the URL is available.

Keep the hostname-scoped HTTP-to-HTTPS redirect at the edge, preserving path and
query string. Verify it independently:

```sh
curl --head http://tanbase-core.tanfust.com/
```

The response must be `301` or `308` with
`Location: https://tanbase-core.tanfust.com/`.

### Markdown for Agents

Markdown negotiation is a `tanfust.com` zone feature, not Worker source or a
binding. After the zone is on a supported plan, enable **Markdown for Agents**
in **AI Crawl Control**, optionally through a Configuration Rule restricted to
`tanbase-core.tanfust.com`, then run the opt-in production smoke check.

As of 2026-09-17, the zone is on the Free plan and the dashboard exposes the
feature as Pro-only. HTML discovery can ship independently. Do not add an
application-side converter as a fallback.

## Local gates

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm db:seed:local
pnpm verify
pnpm cf:typegen
git diff --exit-code -- src/worker-configuration.d.ts
pnpm cf:dry-run:production
pnpm smoke -- --url http://localhost:3000 --environment local
```

The dry run packages the production configuration without changing remote
state. A dry run does not prove that a remote resource or deployment works.

## Automated production flow

For a push to `main`, Workers Builds:

1. Installs dependencies and runs `pnpm verify`.
2. Builds with `CLOUDFLARE_ENV=production`.
3. Applies pending additive migrations to `tanbase-core-production`.
4. Deploys the same commit as the active production version.

Protect `main` and require successful CI and review. Do not enable a second
remote deployment workflow in GitHub Actions.

## Optional branch previews

Branch previews are not part of the default template. A team that needs them
must deliberately:

1. Enable non-production branch builds in Cloudflare Workers Builds.
2. Set the non-production command to `wrangler versions upload`.
3. Enable Preview URLs in both Cloudflare and `wrangler.jsonc`.
4. Add a dedicated Wrangler environment and separate preview resources,
   including D1, rather than connecting previews to production data.
5. Add preview-specific migration, smoke, access-control, and evidence rules.

Preview URLs are public unless protected by Cloudflare Access and are not
generated for Workers that implement Durable Objects. Revisit the entire design
before enabling previews for this roadmap.

## Manual recovery command

This command changes live Cloudflare state and is for explicit recovery only:

```sh
pnpm cf:deploy:production
```

Environment selection belongs in the build command. Do not build once and
attempt to retarget the generated configuration during deployment.

## Production smoke checks

```sh
pnpm smoke -- --url https://tanbase-core.tanfust.com --environment production
# Only after Cloudflare Markdown for Agents is enabled:
pnpm smoke -- --url https://tanbase-core.tanfust.com --environment production --expect-markdown
```

The script checks the database-aware health contract, SSR document, canonical
metadata, discovery headers, sitemap, robots policy, truthful `llms.txt`, and
absence of a server-error page. Record the commit, URL, UTC date, Worker version,
and result in [status](STATUS.md) and the active change record.

## Rollback and recovery

Use Cloudflare deployment rollback to restore the last healthy Worker version,
then revert the repository change. A Worker rollback does not restore D1 or any
other connected resource data.

- Build failure: reproduce with `pnpm verify` and the production dry run.
- Migration failure: do not deploy code; diagnose the additive migration and
  retry only after its state is understood.
- Production smoke failure: roll back the Worker, then repair and reverify.
- Generated-type drift: run `pnpm cf:typegen`, review, and commit the result.

References: [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/),
[build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
and [Preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/).
