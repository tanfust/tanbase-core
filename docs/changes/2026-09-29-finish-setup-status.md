---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-29
---

# 2026-09-29: A deployed copy's setup status, for its owner and their coding agent

## Summary

`pnpm run setup:status` reads the version a deployed Worker serves and says
which optional settings are on, off, or half set up, with the next step for
each. The `finish-setup` skill has a coding agent in a copy run it, fix what
is half set up, and ask the owner about each setting that is off: set it up,
leave it off, or remove its module. The deploy log's last line points to
both. The Production performance workflow, which failed on a deploy that
changed nothing on the landing page, is removed; production is measured by
hand.

## Motivation

- Since [ADR-0022](../decisions/0022-setup-page-asks-nothing-that-can-break.md)
  a first deploy asks for no optional setting, and DEPLOYMENT's "Finishing
  the setup" lists them. The owner wanted a coding agent in their copy to
  read that list, check what is missing, and complete or remove each item.
  A setting can live in `wrangler.jsonc` or only in the dashboard, so only
  the deployed version shows what is on.
- The Production performance workflow's Lighthouse runs on GitHub's shared
  runners ranged from 75 to 96 for the same page. On the deploy of
  `d490fd1` it failed its alarm with a median of 89, and marked `main` as
  failing on the repository's page.

## Behavior and configuration changes

- **`pnpm run setup:status [-- --name <worker>]`** (`scripts/setup-status.mjs`,
  `scripts/setup-status-core.mjs`):
  - Reads the serving version with `wrangler deployments status` and
    `wrangler versions view`, each with `--json`. It sees secret names, never
    their values, and changes nothing.
  - Defaults to the top-level `name` in `wrangler.jsonc`. For a missing
    Worker or a missing login it names the one step to take.
  - **Required:** the `DB` binding, `BETTER_AUTH_SECRET`, and `APP_ENV`, each
    `ok` or `attention`.
  - **Optional:** a custom domain, email, due-date reminders, bot checks,
    analytics, attachments, placement, and AI task breakdown, each `on`,
    `off`, or `attention`, with the next step and the DEPLOYMENT section.
  - `attention` marks a setting that is half set up: a Turnstile site key
    without its secret, `EMAIL_FROM` without the `EMAIL` binding, a
    `BETTER_AUTH_URL` that is not a web address, or one whose `/api/health`
    does not answer with the serving version.
- **`finish-setup` skill** (`.claude/skills/finish-setup/SKILL.md`): check
  the checkout and the login, run the status, fix `attention` first, then
  ask about each `off`. Variables go in the top level's `vars`, or in the
  dashboard; secrets are set by the owner, never through the chat or the
  repository; every push waits for the owner's go-ahead. Attachments,
  reminders, and AI can be removed with the `remove-module` skill.
- **`pnpm run deploy`** ends its log with a line pointing to "Finishing the
  setup" and `pnpm run setup:status`.
- **Performance:** `.github/workflows/production-performance.yml` is
  deleted. CI's Performance budgets job still checks the landing JavaScript
  and Lighthouse on a local build before each merge. The `deploy` skill
  measures production by hand when a change touches a public page.
- **Docs:** DEPLOYMENT's "Finishing the setup", the README's Deploy section,
  DEVELOPMENT's commands, AGENTS' skills, PERFORMANCE, and FEATURES F-019 and
  F-023.
- **Records:** STATUS and the
  [previous change record](2026-09-29-setup-page-asks-nothing.md) record the
  deploy of `d490fd1`.

## Migrations and environment changes

None. A fork that set the `PRODUCTION_URL` repository variable for the
removed workflow can delete it.

## Validation evidence

Local:

- `pnpm verify` without `.dev.vars`: 254 Worker tests, 44 UI tests, 40 setup
  tests, and 47 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build. 12 new script tests cover picking the serving
  version, naming a missing Worker or login, reading `BETTER_AUTH_URL` as
  the Worker does, a first deploy's report, a deploy made without
  `pnpm run deploy`, `APP_ENV`, a pinned origin that serves or does not,
  half-set email and Turnstile, reminders, analytics, attachments,
  placement, AI, and the printed report.
- `pnpm run setup:status` against TanBase's production Worker, version
  `63b27e24`: all three required items `ok`, and all eight optional ones
  `on`, with the pinned origin answering with that version.
- `pnpm run setup:status -- --name no-such-worker-zz9` exited 1 with "No
  Worker named … Pass the name you gave it on the setup page".
- No app code changed, so the browser journeys and dry runs were not rerun.
- The skill has not been run in a copy made with the button.

## Deployment state

| Target     | Commit | URL                        | Date       | Result       |
| ---------- | ------ | -------------------------- | ---------- | ------------ |
| Local      | branch | —                          | 2026-09-29 | Passed       |
| Production | —      | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the merge. The status command and the skill only read.

## Remaining work

- Run the skill in a copy made with the Deploy to Cloudflare button, from a
  clone its owner made.
- The first completed button run, and the timed fresh-account test (F-023).
