---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-18
---

# ADR-0005: Production-only default deployment

## Context

TanBase Core is a reusable boilerplate. Requiring a remote preview environment,
a second D1 database, and preview-specific scripts increases setup work before
the application can ship. Cloudflare Workers Builds can deploy the production
branch without enabling non-production branch builds, and users can add version
previews later when their workflow needs them.

Preview URLs also stop being available once the Worker implements Durable
Objects, which are part of the product roadmap. Local Workers-runtime tests,
GitHub CI, production packaging dry runs, and branch protection provide the
default pre-deployment gates.

## Decision

The repository supports isolated local development and one remote production
environment by default. `main` is the production branch, Cloudflare Workers
Builds is the only remote deployment owner, and non-production branch builds
and Preview URLs are disabled.

Local D1 uses Wrangler's isolated persistence. Production uses a distinct D1
database and applies backward-compatible migrations immediately before code is
deployed. GitHub Actions remains credential-free and runs verification, binding
type drift detection, and a production packaging dry run.

Preview deployment is an optional operator extension. Enabling it requires
non-production branch builds, `wrangler versions upload`, Preview URLs, and
separate data resources appropriate for the application.

## Consequences

The default setup has fewer resources, scripts, environment branches, and
deployment gates. A verified push to `main` can deploy directly to production,
so branch protection and backward-compatible database migrations are required.

The default workflow does not provide remote pre-production testing or a pull
request URL. Teams that need those capabilities must explicitly add and operate
them; local success and a dry run remain distinct from production evidence.

## Alternatives

ADR-0004 enabled a preview version for every non-production branch. That offers
remote review before production, but adds a second operational path that the
template does not require and that later conflicts with Durable Object preview
URL limitations.
