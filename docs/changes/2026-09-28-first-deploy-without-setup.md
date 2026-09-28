---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-28
---

# 2026-09-28: A first deploy with nothing set up

## Summary

A deployment of the top level now needs only Workers Paid. R2 is optional:
`pnpm run deploy` binds the attachments bucket on each deploy while the
account has R2, and deploys without it otherwise. The first deploy creates
`BETTER_AUTH_SECRET`, so the Deploy to Cloudflare button asks for no secret.
An unfinished deployment says on its sign-in page what is missing, the auth
forms name Cloudflare's error 1102 on Workers Free, and the landing page
offers the Deploy to Cloudflare button
([ADR-0021](../decisions/0021-deploy-binds-r2-and-creates-the-auth-secret.md)).

## Motivation

The first outside tester imported the repository from the dashboard. Their
deploy failed because R2 was not enabled
([previous record](2026-09-28-dashboard-import-deploy.md)). That change made
`pnpm run deploy` stop and say to enable R2. The owner wanted no one to stop
on a first try, and three more stops remained:

- R2 is an account opt-in only the owner can make.
- A dashboard import runs `npx wrangler deploy`, which applies no migrations
  and creates no secret.
- A secret pasted on the button's setup page may be too short.

When any of these happened, the sign-in page crashed on the session lookup
and showed "Something went wrong".

## Behavior and configuration changes

- **`wrangler.jsonc`:** the top level no longer declares `r2_buckets`.
  `env.local`, `env.production`, and `wrangler.e2e.jsonc` keep `FILES`. The
  generated `Env` type now marks `FILES` optional. The Worker tests read it
  through `testBucket()`, and `getFilesBucket()` and `/api/health` lost their
  casts.
- **`pnpm run deploy`** (`scripts/deploy.mjs`, `scripts/deploy-resources.mjs`):
  1. Refuses in the upstream checkout.
  2. Clears `CLOUDFLARE_ENV`, and builds the top level when there is no
     top-level build behind `.wrangler/deploy/config.json`.
  3. Creates a missing D1 database.
  4. Checks R2 for `<worker>-files`, or for the bucket a copy still declares.
     It creates the bucket when it is missing, retries an unreadable check
     once, and writes `FILES` into the generated configuration, or leaves it
     out with `Attachments are off: enable R2 …`.
  5. Applies migrations.
  6. Classifies `wrangler secret list --name <worker>` strictly, and passes a
     new 32-byte `BETTER_AUTH_SECRET` through `--secrets-file` only when the
     Worker is missing or lacks one. The file is mode 0600 and removed even
     when the deploy fails.
  7. Deploys with the same `--name`, and ends with `Attachments:` and
     `BETTER_AUTH_SECRET:` lines.
- **The button's prompts:** `.dev.vars.example` is deleted, and so are the
  `BETTER_AUTH_SECRET` and `FILES` descriptions in `package.json`.
- **Unfinished deployments** (`src/modules/auth/installation.server.ts`,
  `session.server.ts`, `challenge.server.ts`,
  `src/components/auth/setup-notice.tsx`):
  - `getSession()` uses `getPageSession()`. When the lookup throws and
    `findInstallationProblem()` finds a database without its `user` table,
    or no usable secret, the page renders signed out.
  - `/login`, `/sign-up`, and `/forgot-password` show a notice naming the
    step to take.
  - Only a database found ready is remembered, per isolate.
  - The secret rule is shared with `validateAuthEnvironment()`.
- **Workers Free** (`src/modules/auth/errors.ts`, `client.ts`): a client
  fetch plugin turns Cloudflare's error page for a Worker over its CPU limit,
  error 1102, into an auth error saying the account likely needs Workers Paid.
  It recognizes the page by its `cf-error-type` header, or by an HTML body
  naming 1102.
- **Copy:**
  - The attachment UI says how to turn attachments on.
  - The landing page's deploy panel and Markdown offer the Deploy to
    Cloudflare button, where they had called it "on the roadmap".
  - The smoke check accepts `files` `ok` or `disabled` for `--config default`.
- **Docs:**
  - README and DEPLOYMENT: the button, the dashboard import, Workers Paid,
    Better Auth, R2, smoke, and the rule on retargeting a build.
  - FRESH_ACCOUNT_TEST, INSTALLING, DEVELOPMENT, OVERVIEW, MODULE_REMOVAL,
    and AGENTS: the binding-rule exceptions.
  - The `add-module` skill, FEATURES, and STATUS.
  - ADR-0021, with a pointer from ADR-0017.

## Migrations and environment changes

None. No migration, variable, or dependency changed, and TanBase's own
production still deploys `env.production` with `pnpm cf:deploy:production`.
A copy made before this change that renamed its Worker but kept the default
bucket should keep its top-level `r2_buckets` block when it merges this, or
its next deploy binds a new, empty `<worker>-files`.

## Validation evidence

Local:

- `pnpm verify` without `.dev.vars`: 249 Worker tests, 41 UI tests, 40 setup
  tests, and 31 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build. New tests:
  - 18 script tests for the deploy helpers;
  - Worker tests for `hasAuthTables`, `authSecretUsable`,
    `findInstallationProblem`, `getPageSession`, `edgeErrorResponse`, and
    `authErrorMessage`;
  - a UI test for `SetupNotice`;
  - the landing Markdown's Deploy to Cloudflare link.
- `pnpm test:e2e` with the system Chrome: 5 passed. The same 5 passed against
  a production build of the e2e Worker, through a temporary Playwright config.
- `pnpm cf:dry-run:production` still binds `FILES` to `tanbase-core-files`;
  `pnpm cf:dry-run:default` binds no R2. Both upload 10,421.05 KiB.
- `pnpm perf:bundle` on the e2e build:
  - `/` 148.0 KB in 14 files, from 147.9 KB;
  - `/login` 185.0 KB, from 184.2 KB, for the notice and the fetch plugin;
  - the post unchanged at 144.9 KB.
- `scripts/deploy.mjs` ran end to end in a scratch checkout with a fork
  `origin` and a stand-in `pnpm` that faked the build and answered like
  Cloudflare:

  | Scenario                                                               | Result                                                                                                                                                                                          |
  | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | No build, R2 off, new Worker                                           | Built, no `FILES`, `--name tanbase-core --secrets-file` with a 0600 file holding one 43-character key, the file removed afterwards; the log said attachments are off and the secret was created |
  | R2 on, bucket missing, secret present                                  | Created `tanbase-core-files` and bound it; no secrets file                                                                                                                                      |
  | `WRANGLER_CI_OVERRIDE_NAME=moondo`, bucket exists, empty secret list   | Bound `moondo-files`, and passed `--name moondo` to both `secret list` and `deploy`, with a new secret                                                                                          |
  | Secret check fails                                                     | A warning, no secrets file, and the deploy ran                                                                                                                                                  |
  | A stale production build, and `CLOUDFLARE_ENV=production` in the shell | Rebuilt the top level with the variable cleared                                                                                                                                                 |
  | A declared legacy bucket, R2 off then on                               | Left out, then bound as `legacy-files`                                                                                                                                                          |
  | Deploy exits 1 with a new secret                                       | Exited 1 and removed the secrets file                                                                                                                                                           |
  | D1 missing                                                             | Created the database before migrations                                                                                                                                                          |
  | Upstream `origin`                                                      | Refused                                                                                                                                                                                         |

- **On the e2e dev server, with `.dev.vars` and the e2e D1 state moved
  aside:**
  - `/sign-up` and `/login`, with and without `?redirect=/app`, showed the
    "database has no tables" notice.
  - `/app` redirected to `/login`.
  - After `pnpm db:migrate:e2e`, `/sign-up` showed the "no usable
    `BETTER_AUTH_SECRET`" notice.
- No command ran against a real Cloudflare account, and no live error 1102
  was seen.

## Deployment state

| Target     | Commit | URL                        | Date       | Result       |
| ---------- | ------ | -------------------------- | ---------- | ------------ |
| Local      | branch | `http://localhost:3110`    | 2026-09-28 | Passed       |
| Production | —      | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the merge. A copy deployed in between keeps the secret it received
and the bucket it bound; both keep working, and the reverted top level names
`tanbase-core-files` again.

## Remaining work

- The tester's retry with the deploy command `pnpm run deploy`, the first
  button run, and the fresh-account test (F-023).
- Confirm on the button's setup page that it no longer lists the R2 bucket
  or `BETTER_AUTH_SECRET`.
