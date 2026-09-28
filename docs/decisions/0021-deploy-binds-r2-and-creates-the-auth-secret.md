---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-28
---

# ADR-0021: The deploy binds R2 when it can and creates the auth secret

## Context

[ADR-0017](0017-wrangler-configuration-layout.md) made the top level of
`wrangler.jsonc` a configuration any account can deploy: every binding with a
default name, and `.dev.vars.example` naming the one secret the Deploy to
Cloudflare button must ask for. The first outside run, on 2026-09-28, showed
that three things still stop a first try:

- **R2 is an account opt-in.** Only the account owner can enable it, and no
  API lets a template do it. Until then, Cloudflare answers Wrangler's check
  for the bucket with a 403, code 10042, which Wrangler treats as missing
  permission: it skips creating the bucket without a word, and the upload then
  fails with `R2 bucket 'tanbase-core-files' not found [code: 10085]`. The
  button reads the same top level before it builds.
- **A dashboard import runs `npx wrangler deploy`.** Workers Builds leaves the
  build command blank and defaults the deploy command to it, so no D1
  migrations run.
- **Nothing asks a dashboard import for `BETTER_AUTH_SECRET`,** and the
  button's field accepts a value shorter than the 32 characters the Worker
  requires. Either way sign-in fails with "Authentication is not configured",
  and the sign-in page itself crashed on it.

The app already runs without `FILES`: its getter returns `null`, health
reports `files: disabled`, and the attachment UI says attachments are off.

## Decision

- **The top level declares no `FILES`.** `env.local`, `env.production`, and
  the e2e config keep it. `pnpm run deploy` checks R2 on every deploy. When
  the account has it, the deploy creates `<worker>-files` if needed and writes
  the `FILES` binding into the configuration `vite build` generated, found
  through Wrangler's redirect, `.wrangler/deploy/config.json`. When it does
  not, the deploy leaves the binding out and says how to turn attachments on;
  the next deploy after enabling R2 does. A copy that still declares `FILES`
  at its top level keeps that bucket name.
- **`pnpm run deploy` creates `BETTER_AUTH_SECRET`.** It asks
  `wrangler secret list` about the Worker, named once for both commands from
  `WRANGLER_CI_OVERRIDE_NAME` or the config. Only when the Worker does not
  exist yet, or exists without the secret, does it pass 32 random bytes to
  `wrangler deploy --secrets-file`, which keeps every other secret. Any other
  answer creates nothing. `.dev.vars.example` is gone, so the button asks for
  no secret.
- **`pnpm run deploy` builds the top level** when there is no top-level build,
  and creates a missing D1 database before the migrations.
- **An unfinished deployment explains itself.** When the session lookup fails
  on a database without its tables, or on a missing or short secret, the
  sign-in pages render signed out with a notice naming the step to take:
  set the deploy command to `pnpm run deploy` and redeploy. The check reads
  the schema once per isolate until the tables exist.
- **Workers Paid stays required.** Workers Free allows 10 ms of CPU per
  request; `/login` and `/app` take 65 and 68 ms at p75 and sign-in over
  100 ms. The auth forms turn Cloudflare's error page for error 1102 into a
  message saying so.

## Consequences

- A first deploy from the button or from a dashboard import set to
  `pnpm run deploy` needs only Workers Paid. Without R2 it runs with
  attachments off.
- The generated configuration is edited in one place, for one optional
  binding. The DEPLOYMENT runbook's rule against retargeting a build still
  holds for environments.
- The generated `Env` type marks `FILES` optional, since the top level lacks
  it; the Worker tests read it through a helper that throws when it is
  missing.
- A copy made before this change that renamed its Worker but kept the
  default bucket, and that merges this change and drops its top-level
  `r2_buckets` block, switches to a new empty `<worker>-files`. Its owner
  should keep the block.
- A deploy whose R2 check cannot be read leaves attachments off for that
  deploy; deleting tasks meanwhile leaves their objects in the bucket.
- Two first builds at once can each create a secret, and the last one wins,
  signing out anyone who signed in between them.
- The notice costs the sign-in pages one schema read per isolate until the
  tables exist.

## Alternatives

- **Keep `FILES` at the top level and drop it from the build when R2 is
  off.** The button provisions the top level before the build, so it would
  still meet the bucket.
- **Rebuild with the Vite plugin's config customizer.** It would build twice
  on the button and change `vite.config.ts` for every build, production's
  included.
- **`wrangler deploy --config` on an edited copy.** It turns Wrangler's
  redirect off and treats the generated file as a user config.
- **Keep `.dev.vars.example`.** The button would keep asking for a secret it
  can make itself, and accept a short one.
- **`secrets.required` in the config.** A first `npx wrangler deploy` of a new
  Worker then fails outright.
- **Run migrations in the build step.** Production's Workers Build runs
  `pnpm verify`, which runs `pnpm build`, and the build step also runs for
  branch builds, so it would change databases from builds that deploy
  nothing.
- **Support Workers Free.** The pages alone exceed its CPU limit.
