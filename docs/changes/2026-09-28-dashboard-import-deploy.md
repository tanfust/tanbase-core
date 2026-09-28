---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-28
---

# 2026-09-28: Deploying a repository imported from the dashboard

## Summary

`pnpm run deploy` creates the D1 database and the R2 bucket when they are
missing, before it applies migrations, and stops with what to do when R2 is
not enabled on the account. The README and the deployment runbook say which
build and deploy commands a repository imported from the dashboard needs.

## Motivation

On 2026-09-28 an outside tester connected a copy of the repository from the
dashboard, under **Workers & Pages → Create → Import a repository**, instead
of using the Deploy to Cloudflare button. The Worker was named `moondo`. The
build passed, and the deploy failed:

```text
R2 bucket 'tanbase-core-files' not found. Verify the bucket exists in your account and that the bucket_name in your configuration is correct. [code: 10085]
```

The build log and Wrangler 4.129.0's source explain it:

- Workers Builds used its default deploy command, `npx wrangler deploy`,
  where the button uses the repository's `pnpm run deploy`. A plain deploy
  never applies D1 migrations, so a successful one would have left the
  database empty and sign-up failing.
- Wrangler created the database and the queue during the deploy. It checks
  whether the R2 bucket exists first, and when Cloudflare answers that check
  with a 403, it skips the bucket silently; its warning prints only after a
  successful upload. An account without an R2 subscription answers with a
  403, code 10042 `NotEntitled`, and the README lists R2 as a prerequisite.

## Behavior and configuration changes

- **`scripts/deploy-resources.mjs`**, new, read by `scripts/deploy.mjs`:
  - `deployResources()` reads the `DB` database and the `FILES` bucket from
    the top level of `wrangler.jsonc`.
  - Before migrations, `prepareResources()` runs `wrangler d1 list --json`,
    and creates the database with `wrangler d1 create <name>
--update-config=false` when it is missing. It skips that check when the
    config names a database ID.
  - It then runs `wrangler r2 bucket info <name> --json`. It creates a
    missing bucket, code 10006, with `wrangler r2 bucket create`, and stops
    with a message when R2 is not enabled, code 10042, or Cloudflare refuses
    the request, code 10000. When a check cannot be read, it logs that and
    lets the deploy go on.
- **`pnpm run deploy`** still refuses to run in the upstream checkout, then
  prepares the resources, applies migrations, and deploys.
- **Docs:** the README's Deploy to Cloudflare section and a new
  "Importing the repository from the dashboard" section in DEPLOYMENT say to
  enable R2 and set the build command to `pnpm run build` and the deploy
  command to `pnpm run deploy`. The fresh-account test asks which way the
  tester deployed, with the build log of a failed build. FEATURES and STATUS
  record the run.

## Migrations and environment changes

None. A deployment made with the button or the installer behaves as before:
its database and bucket already exist, so the new checks only read.

## Validation evidence

Local:

- `pnpm test:scripts`: 9 new tests cover reading the top level, parsing
  `wrangler d1 list --json`, classifying `wrangler r2 bucket info` failures
  by code, and each path through `prepareResources()` with a stand-in
  Wrangler: creating both resources, leaving existing ones alone, skipping
  the database check when the config has an ID, stopping for codes 10042 and
  10000, and going on when a check cannot be read.
- `scripts/deploy.mjs` ran end to end in a scratch checkout whose `origin`
  is a fork, with a stand-in `pnpm` that answered like Cloudflare:
  - With R2 not enabled, code 10042, it stopped before migrations and
    printed the message to enable R2.
  - With the bucket missing, code 10006, it created the bucket, then applied
    migrations and deployed.
- No command ran against a real Cloudflare account.

## Deployment state

| Target     | Commit | URL                        | Date       | Result       |
| ---------- | ------ | -------------------------- | ---------- | ------------ |
| Local      | branch | —                          | 2026-09-28 | Passed       |
| Production | —      | `https://core.tanbase.dev` | —          | Not deployed |

The change touches only `pnpm run deploy`, which TanBase's own production
does not run; production deploys with `pnpm cf:deploy:production`.

## Rollback notes

Revert the merge. Resources the new checks created stay in their accounts
and keep working.

## Remaining work

- The tester's retry: enable R2, set the deploy command to `pnpm run deploy`,
  and retry the build. Their database, `tanbase-core`, already exists, so the
  retry applies migrations to it and creates only the bucket.
- The first run of the Deploy to Cloudflare button itself, and the
  fresh-account test (F-023).
