---
status: superseded
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-18
---

# ADR-0004: Cloudflare-owned branch deployments

Superseded by
[ADR-0005: Production-only default deployment](0005-production-only-default-deployment.md).

## Context

TanBase Core is a public template whose repository is connected directly to
Cloudflare Workers Builds. Running a second deployment system in GitHub Actions
duplicates responsibility, requires Cloudflare credentials in GitHub, and can
race Cloudflare's own deployment for the same commit.

Cloudflare can build non-production branches and upload each result as a Worker
version with a unique preview URL. Uploading a version does not promote it to
the active production deployment.

## Decision

Cloudflare Workers Builds is the only remote deployment owner. GitHub Actions
remains credential-free and performs CI verification and dry runs only.

The production branch is `main`. Its deploy command is
`pnpm cf:deploy:production`. Non-production branch builds are enabled and use
`pnpm cf:upload:preview`, which runs `wrangler versions upload`. Preview and
production builds select their Cloudflare environment during the Vite build,
but both flattened configurations target the `tanbase-core` Worker.

Cloudflare's generated Workers Builds token is used inside Cloudflare. No
`CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` is stored in GitHub.

## Consequences

Every non-production branch can receive an unpromoted, versioned preview URL,
and a push to `main` automatically deploys production. There is no separate
staging Worker, stable preview URL, or manual GitHub production approval gate.
Preview URLs are public unless Cloudflare Access protects them.

Preview and production values and bindings must remain explicit in
`wrangler.jsonc`; selecting an environment after the Vite build cannot retarget
the generated configuration. The deployment topology must be reconsidered
before adding Durable Objects because Cloudflare does not generate preview URLs
for Workers that implement them.

## Alternatives

ADR-0002's separate preview Worker and protected GitHub production environment
provide stronger staging isolation and a manual gate. That design was
superseded to keep one deployment owner, avoid GitHub deployment credentials,
and use the repository's existing Cloudflare Git integration.
