---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# ADR-0011: Place the production Worker next to its D1 primary

## Context

By default a Worker runs in the Cloudflare location that receives the request.
TanBase Core renders pages and runs server functions that make several
sequential D1 queries each, and D1 has one primary. The production primary is
in `WEUR`, in Marseille (`MRS`).

On 2026-09-25 the operator's traffic from Tunis reached Cloudflare through
either Marseille or Rio de Janeiro (`GIG`). Server functions served from `GIG`
took 1.7 to 4.3 seconds of Worker wall time because every query crossed the
Atlantic; the same calls from `BCN` took 40 to 75 ms. `/` took 0.97 to 1.28
seconds through `GIG` and 0.45 seconds through `MRS`.

## Decision

Set a placement hint on the production environment that targets the region
nearest the D1 primary: `"placement": { "region": "azure:francesouth" }`. The
hint is part of this installation's configuration, like its database ID. The
guided installer removes it whenever it points production at a different
database.

## Consequences

Each D1 query becomes a local call, and a distant edge location pays one
forwarding round trip per request instead of one per query. Requests that
never touch D1, such as `robots.txt` or `llms.txt`, also gain that round trip
when they enter far from Marseille; static assets are unaffected. Each Durable
Object stays where it was created; new board rooms are created near the
placed Worker, so events travel one fixed path to visitors. Per-location
features become effectively single-location: the health-check cache and the
`AUTH_LIMITER` counters now see nearly all production traffic in one place,
which makes rate limiting stricter, not looser.

If the D1 primary moves, the hint must be updated. Forks keep default placement
until their operator sets a hint for their own database.

## Alternatives

- Smart Placement (`"mode": "smart"`) chooses a location from observed request
  durations, but requires consistent traffic from multiple locations and only
  considers locations the Worker already runs in. At current traffic it would
  likely report `INSUFFICIENT_INVOCATIONS` and never move.
- D1 read replication with the Sessions API would serve reads from nearby
  replicas, but writes and every authenticated session lookup would still
  reach the primary, and each request would need a session bookmark.
- Splitting an edge Worker from a placed data Worker with a service binding
  keeps unauthenticated requests at the edge, but adds a second Worker and an
  RPC boundary the template does not need yet.
