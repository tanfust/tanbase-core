---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-28
---

# ADR-0020: The installer places each installation next to its D1 primary

## Context

[ADR-0011](0011-placement-near-d1.md) runs the production Worker next to its
D1 primary with a placement hint, and had the guided installer remove the
hint whenever it pointed production at a different database. Every other
installation then ran on default placement: a visitor who enters Cloudflare
far from the primary pays a round trip for each of a page's D1 queries.
ADR-0011 measured 1.7 to 4.3 seconds for server functions that did so.

A D1 query result reports the primary that served it in `meta`:
`served_by_colo`, an airport code such as `MRS`, `served_by_region`, a
location hint such as `WEUR`, and `served_by_primary`. Placement hints name
a cloud region, such as `azure:francesouth`, from a list Cloudflare
publishes at `GET /accounts/{account_id}/workers/placement/regions`.

## Decision

The guided installer reads where the production database's primary is, with
one read-only `select 1` against it, and sets `env.production.placement` to
the cloud region in the same city as the primary's colo. A table in
`scripts/setup/core.mjs` maps each colo to that region; a colo missing from
it falls back to one region per location hint. `pnpm run placement` does the
same for any section of `wrangler.jsonc`, for installations the installer
did not make, such as the Deploy to Cloudflare button's top level.
`--placement <region>` overrides the choice, and `--placement default`
removes the hint.

When the location cannot be read, setup continues as ADR-0011 described: it
keeps the hint for the same database and removes it for a different one.
This replaces the installer part of ADR-0011; the rest of it stands.

## Consequences

An installation made with the installer runs next to its database from its
first deploy. The table must hold only regions Cloudflare accepts, which a
test checks against the published list, and its pairs are judged by
geography, not measured. A rerun replaces a hint set by hand unless
`--placement` names it. If the primary moves, the hint must follow, by
running `pnpm run placement --env production --write`.

## Alternatives

- **Smart Placement** (`"mode": "smart"`): since 2025-02-13 it no longer runs
  Workers next to the D1 databases they are bound to, and it needs steady
  traffic from several locations before it moves a Worker. A new
  installation has neither.
- **The `host` and `hostname` targets** probe an external service's address;
  D1 has none to probe.
- **Documenting the manual steps only**, as ADR-0011 did: installers who
  skip them keep the slow default.
