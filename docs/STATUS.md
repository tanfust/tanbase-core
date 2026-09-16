---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-16
---

# Current status

This is a dated snapshot, not a deployment ledger. GitHub Deployments and
Cloudflare are the current operational record.

## Milestone

Cloudflare Worker foundation: locally verified and deployed to preview. Production
is intentionally pending the protected manual approval flow. The next vertical
slice after this foundation is D1.

## Verification snapshot

| Target     | Commit                                        | URL                                                | Date                 | Evidence                                                                |
| ---------- | --------------------------------------------- | -------------------------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| Local      | Uncommitted tree based on `2522a336f0bd`      | `http://localhost:3004`                            | 2026-09-16 21:03 UTC | `pnpm verify`; smoke passed (ports 3000–3003 were occupied)             |
| Preview    | Same uncommitted tree based on `2522a336f0bd` | `https://tanbase-core-preview.tanfust.workers.dev` | 2026-09-16 21:05 UTC | Deploy and smoke passed; version `7dd0dc57-8002-48c4-8fe8-f501fbc48067` |
| Production | Not deployed                                  | Not assigned                                       | —                    | Not run                                                                 |

## Known blockers

- The preview was built from an uncommitted working tree. Commit these changes
  before using the automated same-commit preview-to-production flow.
- GitHub `preview` and `production` environments still need their Cloudflare
  credentials and `APP_URL`; production also needs required reviewers.
- The public health endpoint is intentionally minimal until the hardening slice.

## Last known deployed commits

- Preview: uncommitted tree based on `2522a336f0bd`; Cloudflare version
  `7dd0dc57-8002-48c4-8fe8-f501fbc48067`.
- Production: none recorded.

Update this file and the active foundation change record after the first remote
smoke check for each environment. Keep local, preview, and production evidence
in separate rows.
