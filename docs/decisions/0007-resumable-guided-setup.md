---
status: accepted
audience: contributors, maintainers, agents
last_verified: 2026-09-20
---

# ADR-0007: Resumable guided setup

## Context

TanBase is a reusable template whose essential local and production setup spans
dependency installation, account selection, D1 provisioning, configuration,
migrations, secrets, deployment, and smoke checks. Requiring buyers to execute
those steps manually creates account-targeting and migration-ordering risk.
Optional services also have plan, domain, or provider prerequisites that cannot
be assumed on a fresh Cloudflare account.

## Decision

The supported clone setup is the repository-owned `pnpm run setup` script. It
uses the pinned Wrangler dependency, applies migrations before application code,
generates secrets into temporary permission-restricted files, and stores only
non-secret resume state under ignored `.tanbase/`.

The default setup includes local D1, production D1, Better Auth configuration,
deployment to `workers.dev`, and smoke verification. Email Service onboarding,
custom domains, Git integration, previews, and future optional bindings are
skipped. Existing same-named resources require recorded ownership or explicit
reuse approval. Setup never deletes remote resources.

## Consequences

A fresh clone has one guided path and safe reruns. Buyer-specific Wrangler and
canonical URL changes remain visible tracked changes that can be reviewed and
committed for Workers Builds. A first deployment may be followed by one URL
reconciliation deployment because the account `workers.dev` hostname is learned
from Wrangler output.

The installer does not prove its launch acceptance criterion until an external
fresh account completes the documented path in under 15 minutes.

## Alternatives

Manual README steps were rejected because they duplicate orchestration and make
secret and migration ordering dependent on operator memory. Automatic D1
provisioning during deploy was rejected for the primary path because the schema
must be migrated before new Worker code receives traffic. Making Cloudflare's
Deploy button the only path was deferred until its migration ordering and the
production-only, no-preview policy are verified.
