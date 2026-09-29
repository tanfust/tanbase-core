---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-29
---

# 2026-09-29: The Deploy button's setup page asks for nothing that can break

## Summary

The Deploy to Cloudflare button's setup page now asks for the repository,
the project name, the D1 database, and three pre-filled AI variables, and
none needs changing. The top level of `wrangler.jsonc` sets no variable whose
default does not work and declares no queue: `pnpm run deploy` binds the
reminder queue `<worker>-email`. Variables set in the dashboard survive later
deploys, a `BETTER_AUTH_URL` that is a bare host or not a web address no
longer fails every page, and the sign-in pages say where sign-in works while
it names another origin. DEPLOYMENT's "Finishing the setup" lists each
optional setting
([ADR-0022](../decisions/0022-setup-page-asks-nothing-that-can-break.md)).

## Motivation

On 2026-09-29 a run of the button stopped on its setup page:

- It asked for `BETTER_AUTH_URL`, `EMAIL_FROM`, `TURNSTILE_SITE_KEY`, and
  `POSTHOG_HOST`, whose descriptions said to leave them empty, and refused to
  continue while they were.
- The tester typed `klapt.ai` into `BETTER_AUTH_URL`. The Worker throws on a
  value without a scheme, so every page that needs the origin would have
  failed. `https://klapt.ai` would have broken sign-in on the `workers.dev`
  address instead, since Better Auth trusts only its own origin.
- The queue field carried the template's name, `tanbase-core-email`.

## Behavior and configuration changes

- **`wrangler.jsonc`:**
  - The top level's `vars` keep only `AI_MODEL`, `AI_GATEWAY_ID`, and
    `AI_DAILY_LIMIT`. `APP_ENV`, `BETTER_AUTH_URL`, `EMAIL_FROM`,
    `TURNSTILE_SITE_KEY`, and `POSTHOG_HOST` are gone from it.
  - The top level sets `keep_vars: true`.
  - The top level declares no `queues`.
  - `env.local`, `env.production`, and `wrangler.e2e.jsonc` are unchanged.
  - The generated `Env` marks `EMAIL_QUEUE` and the five variables optional.
- **`APP_ENV`:** `appEnvironment()` in `src/platform/environment.ts` reads it
  as `local` only when it says so, and as `production` otherwise. Health,
  `robots.txt`, the server entry, and Better Auth read it through that.
- **`pnpm run deploy`** (`scripts/deploy.mjs`, `scripts/deploy-resources.mjs`):
  - `emailQueueName(worker)` names the queue `<worker>-email`, within
    Cloudflare's 63 characters with room for `-dlq`.
  - `withEmailQueue()` writes the `EMAIL_QUEUE` producer and this Worker's
    consumer, with three retries and `<worker>-email-dlq`, into the generated
    configuration. Wrangler creates both queues.
  - A copy whose top level still declares `EMAIL_QUEUE` keeps its queue's
    name.
  - The log adds a `Reminders:` line naming both queues.
- **`BETTER_AUTH_URL`** (`src/platform/origin.ts`):
  - A value without a scheme gets `https://`, and surrounding spaces are
    trimmed.
  - A value that is still not an http or https URL is ignored, with the
    warning `origin.invalid_setting` once per isolate.
- **Sign-in pages** (`challenge.server.ts`, `installation.server.ts`,
  `setup-notice.tsx`): while `BETTER_AUTH_URL` names another origin than the
  request's, `/login`, `/sign-up`, and `/forgot-password` show "Sign-in works
  only at …", with the two ways to fix it. A missing database or secret still
  takes precedence.
- **The button's descriptions** (`package.json` `cloudflare.bindings`): only
  the three `AI_*` variables and `DB` remain.
- **Docs:**
  - DEPLOYMENT: the button's steps and table, the build log's lines, and a
    new "Finishing the setup" section listing each optional setting and
    where to set it.
  - README's Deploy section, DEVELOPMENT, OVERVIEW, MODULE_REMOVAL, and
    FRESH_ACCOUNT_TEST.
  - AGENTS and the `add-module` skill: the rule for top-level variables and
    for resources named after the Worker.
  - ADR-0022, with a pointer from ADR-0017.
- **Records:** STATUS, FEATURES, and the
  [previous change record](2026-09-28-status-label-and-ai-costs.md) record
  the deploy of `3080510`.

## Migrations and environment changes

No migration or dependency changed, and TanBase's own production still
deploys `env.production` with `pnpm cf:deploy:production`.

- `keep_vars` applies to `env.production` too: a variable removed from its
  block stays on the Worker until it is removed in the dashboard.
- A copy made before this change that merges it, without its own top-level
  queue, moves reminders to `<worker>-email`. Messages still waiting in the
  old queue are not consumed; reminders are hourly, so at most one run's are
  lost. To keep the old queue, keep the top-level `queues` block.

## Validation evidence

Local:

- `pnpm verify` without `.dev.vars`: 254 Worker tests, 44 UI tests, 40 setup
  tests, and 35 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build. New tests cover:
  - `appEnvironment()` with `local`, `production`, an empty value, and none;
  - `configuredOrigin()` with a bare host, spaces and a trailing slash, an
    http origin, and values that are not http or https URLs;
  - `findOriginMismatch()`, and `SetupNotice` with a mismatch, and with a
    missing database taking precedence over one;
  - `emailQueueName()`, a declared legacy queue, and `withEmailQueue()`.
- `pnpm test:e2e` with the system Chrome: 5 passed.
- `pnpm cf:dry-run:default` binds only the three `AI_*` variables, no queue,
  and no R2. `pnpm cf:dry-run:production` still binds `EMAIL_QUEUE` to
  `tanbase-core-email`, `FILES`, and all five variables. Both upload
  10,423.79 KiB.
- `pnpm cf:typegen` left `src/worker-configuration.d.ts` unchanged.
- The top-level build's `dist/server/wrangler.json` sets `keep_vars: true`
  and only the `AI_*` variables. Run against it with
  `WRANGLER_CI_OVERRIDE_NAME=klapt` and a stand-in `pnpm`, `scripts/deploy.mjs`
  bound `klapt-files`, `klapt-email`, and `klapt-email-dlq`, and passed
  `--name klapt`.
- On the e2e dev server, whose `BETTER_AUTH_URL` is `http://localhost:3110`,
  `/login` at `http://[::1]:3110` showed "Sign-in works only at
  http://localhost:3110", and at `http://localhost:3110` it showed no notice.
- No command ran against a real Cloudflare account, and the button's setup
  page has not been seen since the change.

## Deployment state

| Target     | Commit | URL                        | Date       | Result       |
| ---------- | ------ | -------------------------- | ---------- | ------------ |
| Local      | branch | —                          | 2026-09-29 | Passed       |
| Production | —      | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the merge. A copy deployed in between keeps its `<worker>-email`
queues and the variables it set in the dashboard; the reverted top level
names `tanbase-core-email` again and sets its variables to empty strings.

## Remaining work

- Confirm on the button's setup page that it lists only the D1 database and
  the three `AI_*` variables.
- The first completed button run, and the timed fresh-account test (F-023).
- Guidance for a coding agent working in a copy: read "Finishing the setup",
  find what is not set, and offer to set or remove it.
