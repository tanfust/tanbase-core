---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# 2026-09-25: Place the production Worker next to D1

## Summary

The production Worker now runs next to its D1 primary in Marseille through the
placement hint `azure:francesouth`, instead of in whichever edge location
receives each request.
[ADR-0011](../decisions/0011-placement-near-d1.md) records the decision.

## Motivation

Worker logs from the F-011 production check showed the operator's traffic from
Tunis reaching Cloudflare through Rio de Janeiro (`GIG`) as well as Marseille
(`MRS`). From `GIG`, server functions took 1.7 to 4.3 seconds of Worker wall
time, because each sequential D1 query crossed the Atlantic to the `WEUR`
primary. The same calls from `BCN` took 40 to 75 ms.

## Behavior and configuration changes

- The production Wrangler environment sets
  `"placement": { "region": "azure:francesouth" }`. Local development and the
  browser-test configuration are unchanged.
- `updateWranglerInstallation` removes the production placement when the
  installer points production at a database other than the configured one, so
  forks start on default placement.
- DEPLOYMENT, OVERVIEW, AGENTS, and F-019 describe the placement and how to
  choose one.

## Migrations and environment changes

No migration, binding, or secret. The primary's location came from a
read-only D1 API query (`served_by_region: WEUR`, `served_by_colo: MRS`,
`served_by_primary: true`), and `azure:francesouth` is listed by
`GET /accounts/{account_id}/workers/placement/regions`.

## Validation evidence

Local:

- `pnpm verify` — passed.
- `pnpm test:setup` — 22 tests passed, including the new placement case: the
  hint survives with the same database and is removed for another.
- `pnpm cf:dry-run:production` — passed; `dist/server/wrangler.json` carries
  `placement.region: azure:francesouth`.

Production baseline before the change, measured from Tunis with `curl` (new
connection each time, so TLS is included):

| Path          | Through `GIG`   | Through `MRS`   |
| ------------- | --------------- | --------------- |
| `/`           | 0.97 s – 1.28 s | 0.45 s          |
| `/api/health` | —               | 0.30 s – 0.64 s |
| `/login`      | —               | 0.15 s – 0.34 s |
| `/robots.txt` | —               | 0.10 s – 0.11 s |

Production after the change:

- Workers Build `1984aacc` deployed merge `8d2581d` as version `cfb92e4c` at
  22:39:35 UTC; its post-deploy smoke passed on the first attempt.
- Every dynamic response carries `cf-placement: remote-MRS`, including
  requests entering through `GIG`.
- Signed-in server functions entering through `GIG` now take 24 to 165 ms of
  Worker wall time, against 1.7 to 4.3 seconds before; through `BCN`, 54 to
  87 ms. A `GET /` entering through `GIG` took 9 ms of wall time.
- The operator confirmed the board shows Live, and Worker logs show upgrades
  through `BCN` reaching the room through the placed Worker.

Time to first byte from Tunis after the change:

| Path          | Before, through `MRS` | After, through `MRS` |
| ------------- | --------------------- | -------------------- |
| `/`           | 0.45 s                | 0.33 s – 0.36 s      |
| `/api/health` | 0.30 s – 0.64 s       | 0.13 s – 0.15 s      |
| `/login`      | 0.15 s – 0.34 s       | 0.13 s – 0.15 s      |
| `/robots.txt` | 0.10 s – 0.11 s       | 0.13 s               |

`/` entering through `GIG` still took 1.04 s to first byte. The Worker spent
9 ms on it, so the rest is the network path from Tunis to Rio de Janeiro,
which placement cannot change. `robots.txt` gained about 20 ms of forwarding,
the expected cost for a request that does not use D1.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------ |
| Local      | Working tree based on `660c1b5` | —                          | 2026-09-25 | Passed |
| Production | `8d2581d` / version `cfb92e4c`  | `https://core.tanbase.dev` | 2026-09-25 | Passed |

## Rollback notes

Delete the `placement` key from the production environment and deploy, or roll
back the Worker version. Nothing else depends on it.

## Remaining work

- Server-rendered `/app` used 62 to 160 ms of CPU in these logs, above the
  50 ms p75 budget in OVERVIEW; F-019 owns measuring and reducing it.
- The end-of-roadmap installation guide should explain choosing a placement
  for each installation's own D1 region.
