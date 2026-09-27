---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: A Deploy to Cloudflare button and a generic top level

## Summary

The top level of `wrangler.jsonc` is now a production configuration any
Cloudflare account can deploy as committed, and the README has a Deploy to
Cloudflare button for it. Local development moves to `env.local`, and
`env.production` stays the TanBase demo. This is the second half of F-023
([ADR-0017](../decisions/0017-wrangler-configuration-layout.md)).

## Motivation

The button deploys only the top level of the Wrangler configuration, and that
used to be local development. With the Worker working without an origin or
email ([ADR-0016](../decisions/0016-deploy-without-personalization.md)), the
configuration was the last thing standing between a fork and one-click
deployment.

## Behavior and configuration changes

- **The top level is generic production:**
  - `APP_ENV=production`
  - empty `BETTER_AUTH_URL`, `EMAIL_FROM`, `TURNSTILE_SITE_KEY`, and
    `POSTHOG_HOST`
  - the `AI` binding, and every other binding with a default name and no
    account-specific ID
  - no `EMAIL` binding and no placement hint
- **`env.local` holds the previous top level unchanged.** `env.production`
  is unchanged.
- **Local scripts select `env.local`:**
  - `vite.config.ts` makes `vite dev` use it when no `CLOUDFLARE_ENV` is set,
    so `pnpm dev`, the dev-client check, and any other start get local
    development
  - `db:migrate:local` and `db:seed:local` pass `--env local`, and the Worker
    tests set `environment: "local"`
- **New `pnpm run deploy`** (`scripts/deploy.mjs`) applies D1 migrations and
  deploys the top level. It refuses to run in the upstream
  `tanfust/tanbase-core` checkout, where it would replace the demo's
  production Worker.
- **New `pnpm cf:dry-run:default`,** which CI runs in its Cloudflare job.
- **For the button's setup page:** `package.json` describes each setting in
  `cloudflare.bindings`, and `.dev.vars.example` lists `BETTER_AUTH_SECRET`
  as the secret it asks for.
- **The `.dev.vars.example` placeholder is 21 characters,** shorter than auth's
  32-character minimum. A fork that keeps it fails closed with "Authentication
  is not configured" instead of sharing a known secret. `.gitignore` lets that
  one file through.
- **`pnpm smoke` takes `--config default|local|production`** to choose the
  configuration section it checks against.
- **The guided installer** writes local names under `env.local`.
  `src/worker-configuration.d.ts` is regenerated.
- **Docs:**
  - README: the button and what it needs
  - DEPLOYMENT: the layout, a button section with the resources it creates,
    and after-deploy steps
  - DEVELOPMENT: the three sections
  - INSTALLING: the two paths
  - AGENTS, the skills, and the module removal guide: bindings in every
    section
  - a new fresh-account test script, and ADR-0017

## Migrations and environment changes

None for TanBase production, which keeps deploying `env.production` from
Workers Builds. Existing local D1 state carries over; `pnpm db:migrate:local`
finds it through `env.local`.

## Validation evidence

Local:

- `node --test scripts/deploy-guard.test.mjs`: 9 tests, including the
  upstream-remote check in every URL form. `node scripts/deploy.mjs` in this
  checkout refused with exit 1.
- `pnpm test:setup`: 23 tests, with the fixture in the new layout.
- `pnpm dev`: `/api/health` reported `environment: local`, and
  `pnpm smoke -- --url http://localhost:3000 --environment local` passed.
  `pnpm test:dev-client` loaded 92 modules.
- `pnpm build` followed by `pnpm exec wrangler deploy --dry-run` packaged the
  top level:
  - generic variables
  - `DB`, `FILES`, `EMAIL_QUEUE`, `BOARD`, `BREAKDOWN`, `AI`, and both rate
    limits
  - no `EMAIL` binding and no placement hint
- **`vite preview` of that build:**
  - health reported `production`
  - the canonical link, robots, sitemap, and `llms.txt` used the request's
    origin, `http://localhost:4391`, with no Turnstile widget
  - `pnpm smoke -- --url http://localhost:4391 --environment production --config default`
    passed
  - a new account created in the browser, with no email configured, landed
    on its board
- `pnpm verify` steps without `.dev.vars`: 182 Worker, 21 UI, 23 setup, and 9
  script tests passed, with format, lint, docs, schema, types, boundaries, and
  build.
- `pnpm cf:dry-run:production` and `pnpm cf:dry-run:default` — passed.
  `pnpm cf:typegen` is stable against the committed types.
- `pnpm test:e2e` with the system Chrome: 3 passed.

Production, 2026-09-27, merge commit `b84bbfe`:

- PRs #39 and #40 merged 12 seconds apart. Workers Build `f398ff4b`, for the
  older `85d6338`, uploaded no version. Workers Build `e09bd7f3`, for
  `b84bbfe`, deployed version `e83b7e10` at 15:51 UTC and passed its
  post-deploy smoke.
- `/api/health` reported `environment: production` and version `e83b7e10`,
  and `pnpm smoke -- --environment production --expect-version e83b7e10-08ea-4b2a-810d-3f3906ba5e44`
  passed at 15:52 UTC.
- `env.production` deployed as before. `wrangler versions view` lists the same
  bindings, variables, and secrets for `e83b7e10` as for the previous version,
  `8f17bbc6`:
  - `EMAIL` restricted to `noreply@send.tanbase.dev`
  - the pinned D1 database
  - `BETTER_AUTH_URL=https://core.tanbase.dev`
  - the production Turnstile key
- Also unchanged:
  - `cf-placement: remote-MRS`
  - the hourly cron, re-applied at deploy
  - the email queue, with the Worker as producer and consumer
- **Live pages:**
  - the canonical link, JSON-LD, the sitemap, and robots name
    `core.tanbase.dev`
  - `/login` loads the production Turnstile widget and asks for a verified
    email
  - `/forgot-password` shows no email notice

## Deployment state

| Target     | Commit                                | URL                        | Date       | Result |
| ---------- | ------------------------------------- | -------------------------- | ---------- | ------ |
| Local      | Working tree based on `af8a708`       | `http://localhost:4391`    | 2026-09-27 | Passed |
| Production | `b84bbfe` / Worker version `e83b7e10` | `https://core.tanbase.dev` | 2026-09-27 | Passed |

## Rollback notes

Revert the change. Local development returns to the top level. Forks made
with the button keep their own copy of the configuration.

## Remaining work

- Run the button once and record what it provisions, including how Workers
  Builds runs the `deploy` script, since `pnpm deploy` is also a pnpm command.
- The outside fresh-account test, from `docs/FRESH_ACCOUNT_TEST.md`.
- The landing page's deploy panel still says the button is on the roadmap;
  change it once the button run passes.
