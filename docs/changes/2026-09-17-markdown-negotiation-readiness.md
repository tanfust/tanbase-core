---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-17
---

# 2026-09-17: Markdown negotiation readiness

## Summary

Adds an explicit production smoke gate for Cloudflare Markdown for Agents,
activates the canonical custom hostname, and records the verified plan boundary
without adding an application-side HTML converter.

## Motivation

Agent requests with `Accept: text/markdown` returned HTTP 500. The linked agent
skill and Cloudflare documentation identify Markdown conversion as a zone-edge
capability that must preserve ordinary HTML responses for browsers.

## Behavior and configuration changes

- Adds `--expect-markdown` to the smoke command. The opt-in gate checks HTTP 200,
  Markdown media type, `Vary: Accept`, a positive `x-markdown-tokens` value,
  Content Signals preservation, a Markdown heading, and absence of an HTML
  document.
- Makes the production robots smoke check compatible with Cloudflare-managed
  bot groups by validating the application's exact crawlable wildcard group.
- Documents the confirmed Cloudflare plan requirement and keeps the feature
  incomplete while negotiation returns HTTP 500.
- Attaches `tanbase-core.tanfust.com` to the production `tanbase-core` Worker.

## Migrations and environment changes

No data migrations, Worker bindings, variables, secrets, or application routes
are added. Cloudflare created the custom hostname and edge certificate. The
existing zone-level HTTP redirect sends the HTTP root to the exact HTTPS URL.

The `tanfust.com` zone is on the Free plan. On 2026-09-17, the Cloudflare
dashboard displayed Markdown for Agents as disabled and Pro-only. No plan
purchase or upgrade was attempted.

## Validation evidence

Local evidence:

- `pnpm verify` — passed formatting, lint, documentation checks, TypeScript, 13
  tests, the deliberate import-protection failure, and the Worker build. Wrangler
  could not write its optional user-level debug log in the sandbox, but the
  build completed successfully.
- `git diff --check` — passed.

Production evidence:

- Cloudflare Workers Builds: commit `efd9161`, active Worker version
  `d91d365d`.
- `curl` to the HTTP root returned `301` with
  `Location: https://tanbase-core.tanfust.com/`.
- `curl` to the HTTPS root returned HTTP 200 and `text/html; charset=utf-8` with
  the discovery Link and Content Signals headers.
- `pnpm smoke -- --url https://tanbase-core.tanfust.com --environment production`
  passed.
- `pnpm smoke -- --url https://tanbase-core.tanfust.com --environment production --expect-markdown`
  failed at the intentional gate because the negotiated request returned HTTP
  500 instead of 200.
- The live readiness scanner reported level 2, Bot-Aware. Robots, sitemap, Link
  discovery, AI bot rules, and Content Signals passed; Markdown negotiation was
  the stated requirement for level 3.

Preview evidence: not run. The production result does not validate the
unpromoted same-Worker preview path.

## Deployment state

| Target     | Commit                          | URL                                | Date                 | Result                                      |
| ---------- | ------------------------------- | ---------------------------------- | -------------------- | ------------------------------------------- |
| Local      | Working tree based on `efd9161` | Local only                         | 2026-09-17           | Verify and diff check passed                |
| Preview    | —                               | —                                  | —                    | Not uploaded                                |
| Production | `efd9161` / version `d91d365d`  | `https://tanbase-core.tanfust.com` | 2026-09-17 16:42 UTC | HTML discovery smoke passed; Markdown gated |

## Rollback notes

Remove the custom domain from the `tanbase-core` Worker to reverse the external
activation. Revert the smoke and documentation changes together if the
negotiation contract changes. Do not remove Cloudflare-managed robots policy as
part of this rollback; it is zone-level behavior shared with other hosts.

## Remaining work

- Upgrade the zone to a supported plan only with explicit operator approval.
- Enable Markdown for Agents, preferably scoped to
  `tanbase-core.tanfust.com`, then pass the opt-in production smoke gate.
- Upload and smoke the first same-Worker branch preview.
