---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-25
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
- [ADR-0007: Resumable guided setup](0007-resumable-guided-setup.md)
- [ADR-0008: Canonical production domain](0008-canonical-production-domain.md)
- [ADR-0009: Public health endpoint with a cached database check](0009-public-health-endpoint.md)
- [ADR-0010: Optional, privacy-first PostHog analytics](0010-privacy-first-analytics.md)
- [ADR-0011: Place the production Worker next to its D1 primary](0011-placement-near-d1.md)
- [ADR-0012: At-most-once due-date reminders](0012-at-most-once-reminders.md)

Never rewrite an accepted decision to hide a later change. Add a replacement ADR
and link the superseded record to it.
