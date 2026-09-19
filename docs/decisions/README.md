---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-18
---

# Architecture decision records

ADRs preserve decisions that should outlive an implementation PR. Copy
[the template](TEMPLATE.md), use the next four-digit number, and set its status
to `proposed`, `accepted`, `superseded`, or `rejected`.

Accepted decisions:

- [ADR-0001: Cloudflare Workers runtime and custom entry](0001-cloudflare-workers-runtime.md)
- [ADR-0002: Preview-to-production promotion](0002-preview-production-promotion.md) — superseded by ADR-0004
- [ADR-0003: Documentation source hierarchy](0003-documentation-source-hierarchy.md)
- [ADR-0004: Cloudflare-owned branch deployments](0004-cloudflare-owned-branch-deployments.md) — superseded by ADR-0005
- [ADR-0005: Production-only default deployment](0005-production-only-default-deployment.md)
- [ADR-0006: D1 as the Better Auth session store](0006-d1-auth-session-storage.md)

Never rewrite an accepted decision to hide a later change. Add a replacement ADR
and link the superseded record to it.
