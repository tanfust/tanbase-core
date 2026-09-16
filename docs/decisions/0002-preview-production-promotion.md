---
status: superseded
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-16
---

# ADR-0002: Preview-to-production promotion

Superseded by [ADR-0004: Cloudflare-owned branch deployments](0004-cloudflare-owned-branch-deployments.md).

## Context

Cloudflare Vite environments are resolved during the build. TanBase Core needs
remote evidence before production and an explicit human production gate while
ensuring both targets use the same repository commit.

## Decision

Preview and production are separate Workers. A push to `main` verifies, builds,
deploys, and smokes preview. Production depends on preview success and uses a
protected GitHub `production` environment for manual approval. It checks out the
same commit and performs a new production-environment build before deployment.

## Consequences

Production is never promoted from an artifact containing preview configuration.
The same source commit is used, but builds are deliberately separate. GitHub
environment reviewers must be configured outside the repository.

## Alternatives

One Worker with mutable environment variables was rejected because it weakens
isolation. Reusing one build artifact was rejected because environment selection
is a Vite build-time operation. Automatic production deployment was rejected
because this milestone requires manual approval.
