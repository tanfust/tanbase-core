---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: Deploy button setup notes and repository cleanup

## Summary

An outside tester reached the Deploy to Cloudflare setup page, and the docs
now say what to choose on it. The repository also loses leftovers a new
developer would stumble on.

## Motivation

The setup page answered F-023's open questions:

- It offers the D1 database, R2 bucket, and queue by name.
- It deploys with `pnpm run deploy`, the repository's script, not pnpm's
  built-in `pnpm deploy`.

It also showed defaults the README did not mention:

- **Protect with Cloudflare Access** is ticked.
- **Create private Git repository** is unticked.
- Every top-level variable is editable, including `TURNSTILE_SITE_KEY`, whose
  secret the page cannot set.

The tester stopped before deploying, because the account was on Workers Free.

## Behavior and configuration changes

- **README:** the Deploy to Cloudflare section lists what to choose on the
  setup page:
  - a private repository
  - the resource names, and one copy per account because of the Workflow's
    name
  - a secret of at least 32 characters
  - empty optional variables for the first deploy
  - Access off for a public app, and preview builds off
- **DEPLOYMENT:**
  - the resource table gains each resource's default name
  - a record of the setup page's fields, and how to turn Access off if the
    URL asks for a Cloudflare sign-in
- **`package.json`:** the setup page's description of `TURNSTILE_SITE_KEY`
  says to add the secret first, since a site key without it stops sign-in.
- **Fresh-account test:** asks the tester about the Access checkbox and any
  Cloudflare sign-in.
- **FEATURES:** F-023's progress records the setup page.
- **MODULE_REMOVAL:** notes that the throwaway branches were deleted and their
  CI runs remain.
- **README:** its documentation list links PERFORMANCE and the fresh-account
  test.
- **DEVELOPMENT:**
  - notes that `pnpm perf:lighthouse` needs Node.js 22.19 or newer
  - corrects the local email section to name `env.local`, where it still said
    "the base configuration"
- **Cleanup:** removes `.cta.json`, the create-tanstack-app scaffold record
  that named the project `start-app`. Nothing reads it.
- **Evidence:** records the F-027 deploy in STATUS and its change record.

## Migrations and environment changes

None.

## Validation evidence

- `pnpm verify` without `.dev.vars` or `.env`: 201 Worker, 24 UI, 24 setup,
  and 13 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build.
- The setup page's fields come from the tester's report on 2026-09-27.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result       |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------------ |
| Local      | Working tree based on `4ccfb71` | —                          | 2026-09-27 | Passed       |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the change. Only docs, a setup-page description, and a scaffold file
change.

## Remaining work

- A complete button deploy on a Workers Paid account, to confirm the
  dead-letter queue, Durable Object, and Workflow and what Access protects.
- The outside fresh-account test.
