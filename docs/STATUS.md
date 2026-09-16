---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-16
---

# Current status

This is a dated snapshot, not a deployment ledger. GitHub Deployments and
Cloudflare are the current operational record.

## Milestone

Cloudflare Worker foundation: implementation and local verification in progress.
The next vertical slice after this foundation is D1.

## Verification snapshot

| Target     | Commit                     | URL                     | Date       | Evidence         |
| ---------- | -------------------------- | ----------------------- | ---------- | ---------------- |
| Local      | Pending final verification | `http://localhost:3000` | 2026-09-16 | Not yet recorded |
| Preview    | Not deployed               | Not assigned            | —          | Not run          |
| Production | Not deployed               | Not assigned            | —          | Not run          |

## Known blockers

- Preview needs a Cloudflare account and least-privilege API token available to
  Wrangler or the GitHub `preview` environment.
- Production requires the GitHub `production` environment, required reviewers,
  Cloudflare credentials, and `APP_URL` before approval can be exercised.
- The public health endpoint is intentionally minimal until the hardening slice.

## Last known deployed commits

- Preview: none recorded.
- Production: none recorded.

Update this file and the active foundation change record after the first remote
smoke check for each environment. Keep local, preview, and production evidence
in separate rows.
