---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# ADR-0009: Public health endpoint with a cached database check

## Context

`GET /api/health` returns the service, environment, and D1 status, and runs a
`SELECT 1` on every request. F-018 required it to be protected or removed before
public launch. The production smoke suite, which Workers Builds runs after
every deployment, depends on it, and external uptime monitors need an
unauthenticated liveness URL.

The response exposes no identifiers or error details. The remaining risk was
that anyone could turn repeated requests into unbounded D1 queries.

## Decision

Keep `/api/health` public and unauthenticated. Cache a successful database
check for 30 seconds in each Cloudflare location through the Workers Cache API,
keyed on the serving origin. Failed checks are never cached, so recovery shows
on the next request. Responses to clients keep `Cache-Control: no-store` and the
existing JSON contract.

## Consequences

Smoke checks and uptime monitors keep working without secrets in Workers Builds
or monitoring tools. D1 load from the endpoint is bounded to about one query
per location every 30 seconds while healthy. A database outage can be reported
up to 30 seconds late in a location that recently saw a success. Cloudflare
documents functional Cache API operations for Workers on custom domains; on
`workers.dev` hostnames the check may run on every request.

## Alternatives

Protecting the database check with a token would hide the D1 status but
require distributing a secret to Workers Builds and every monitor. Removing the
endpoint would leave smoke checks and monitors without a database-aware
liveness signal.
