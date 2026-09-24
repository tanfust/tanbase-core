---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-24
---

# ADR-0008: Canonical production domain

## Context

The canonical origin appears in the Better Auth URL, canonical and Open Graph
metadata, discovery links, `llms.txt`, and the production smoke contract. It
also scopes the Turnstile widget hostname and the transactional email sender
domain, so changing it after those features ship means reconfiguring each of
them.

The production Worker was served from `tanbase-core.tanfust.com`, a subdomain of
the agency site. The `tanbase.dev` domain now belongs to the project and is an
active zone in the same Cloudflare account. The TanBase product line also
includes paid editions that need a brand home separate from the Core
reference deployment.

## Decision

`https://core.tanbase.dev` is the canonical origin of the TanBase Core
production deployment. It is attached to the `tanbase-core` Worker as a custom
domain, and the `tanbase.dev` zone enforces HTTPS with Always Use HTTPS.

The apex `tanbase.dev` and `www.tanbase.dev` are reserved for the TanBase brand
site. Until it exists, a zone redirect sends them to the canonical origin with a
temporary `302`, preserving path and query string.

`tanbase-core.tanfust.com` remains attached to the Worker so its DNS record and
certificate stay managed, and a `tanfust.com` zone redirect rule sends it to the
canonical origin with a permanent `301`, preserving path and query string. This
paragraph was amended on 2026-09-24; see
[Amendment](#amendment-2026-09-24).

Redirects are zone rules, not Worker code, so the application stays
host-agnostic apart from its one configured origin. Forks keep the guided
installer's `workers.dev` origin until they attach their own domain.

## Consequences

The Better Auth URL, Turnstile hostname, and email sender domain bind to a
project-owned domain that no longer changes with the agency site. Zone-level
features such as Markdown for Agents now depend on the `tanbase.dev` zone plan.

Sessions issued on the former hostname do not carry over, because cookies are
host-scoped. The former hostname and its redirect rule must be kept while
external links to it exist. Replacing the temporary apex redirect with the
brand site is a separate change that must not alter the Core origin.

## Alternatives

Serving Core from the apex was rejected because the apex belongs to the wider
TanBase brand. Keeping `tanbase-core.tanfust.com` was rejected because it ties
the product's identity, auth URL, and sender reputation to the agency domain. A
Worker-level host redirect was rejected because a zone rule runs before the
Worker and keeps redirect policy out of application code.

## Amendment (2026-09-24)

The redirect for the former hostname was not implemented. Right after the
canonical-origin deployment, the operator removed `tanbase-core.tanfust.com`
from the Worker, which deleted its DNS record, so the hostname no longer
resolves. It had no users or known external links, so a permanent redirect rule
in the agency zone was not worth maintaining. The rest of this decision stands.
