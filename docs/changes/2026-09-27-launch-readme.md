---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: The README ready for launch

## Summary

The README now says what TanBase Core is in its first lines and links the
live demo, the deploy steps, and the docs. It gains the primitive map and a
cost section, which a test keeps equal to the homepage's copy. With the MIT
license and the public repository and demo, F-024's criteria are met. The
launch video and posts are no longer tracked in the repository. The Better
Auth skill joins the vendored agent skills.

## Motivation

F-024 asks for a README that covers what the project is, the primitive map,
the quick start, the cost model, and removing a module. The README had the
quick start and module removal. Its opening read like a changelog, and it
sent readers to the landing page for the map and the cost.

## Behavior and configuration changes

- **README:**
  - a new opening with links to the demo, the quick start, and the docs
  - a **Primitive map** table of feature, Cloudflare product, and binding
  - a **Cost** section with the $5 Workers Paid target, the Workers Paid
    requirement, the risks, and the guardrails, linking the allowance tables
    on the landing page and in OVERVIEW
  - a stale sentence about bindings "deferred until their feature" removed
- **Test:** `src/modules/seo/readme.ui.test.ts`, in the jsdom suite, fails when
  the README's primitive map or cost lists differ from
  `src/modules/seo/homepage.ts`.
- **FEATURES:** F-024's README criterion is met, the launch video and posts
  criterion is removed, and F-024 waits on F-023. F-019 is marked done with
  the board's second measurement.
- **Agent skills:** `better-auth-best-practices` from `better-auth/skills` is
  added the way the other vendored skills are:
  - the files in `.agents/skills/better-auth-best-practices/`
  - a symlink in `.claude/skills/`
  - an entry in `skills-lock.json`
- **F-019 evidence:** PERFORMANCE, STATUS, and the F-019 change records hold
  the #46 deploy and the board's second measurement.

## Migrations and environment changes

None.

## Validation evidence

Local, on `feat/f024-public-launch`:

- `pnpm verify` without `.dev.vars` or `.env`: 199 Worker, 23 UI, 23 setup,
  and 13 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build. The UI suite includes the two new README checks.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result       |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------------ |
| Local      | Working tree based on `8da5e5a` | —                          | 2026-09-27 | Passed       |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the change. Only the README, docs, a test, and an agent skill change.

## Remaining work

- F-023: the first Deploy to Cloudflare button run and the outside
  fresh-account test. The launch waits on both.
- The landing page still says the button is on the roadmap; change it after
  the button run passes.
