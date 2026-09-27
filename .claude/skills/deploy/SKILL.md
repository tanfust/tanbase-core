---
name: deploy
description: Ship a TanBase Core change to production and prove it, through a pull request, the Workers Build on main, a pinned production smoke, and recorded evidence. Use when asked to deploy, release, ship, verify a deploy, "pull main and verify", check what production runs, or roll back.
---

# Deploy and verify

Cloudflare Workers Builds deploys production from `main`. GitHub Actions only
verifies. Never deploy from a laptop except for explicit recovery, and never
infer a deploy from a local build or dry run.

The full runbook is `docs/DEPLOYMENT.md`.

## Before merge

1. Run the gates. CI has no secrets, so run the tests without `.dev.vars`
   when the change touches auth or anything that reads a secret:

   ```sh
   pnpm verify
   pnpm cf:dry-run:production
   ```

2. When `wrangler.jsonc` changed, run `pnpm cf:typegen` and commit the result.
3. Check that each D1 migration only adds. Workers Builds applies migrations
   before deploying the code, so the version still running must keep working
   against the new schema.
4. Check `git status --short` and stage only the change's files.
5. Open a pull request. `main` is protected: the three Node verify jobs and
   the Cloudflare types and dry-run job must pass.

The person merges. Do not merge or enable auto-merge unless asked.

## After merge

Workers Builds runs `pnpm verify`, builds with `CLOUDFLARE_ENV=production`,
applies migrations, deploys, and runs the post-deploy smoke. A build whose
commit is no longer the tip of `main` skips its deploy.

1. Pull `main` and note the merge commit.
2. Find the build and its result:

   ```sh
   gh api repos/<owner>/<repo>/commits/<merge-sha>/check-runs \
     --jq '.check_runs[] | "\(.name): \(.status) \(.conclusion) \(.details_url)"'
   ```

   The `Workers Builds: <worker>` run links to the build. If it is still
   running, wait for it to finish rather than polling in a tight loop.

3. Find the deployed version and confirm it is the one this merge produced:

   ```sh
   pnpm exec wrangler deployments list --env production
   curl -s https://<origin>/api/health
   ```

   The health `version` must match the newest deployment, created after the
   merge time. When two merges land close together, confirm the newest
   commit's version won.

4. Run the smoke suite pinned to that version:

   ```sh
   pnpm smoke -- --environment production --expect-version <version-id>
   ```

5. Check the change's own behavior on the live site: the page, endpoint, or
   header it changed.
6. Check the **Production performance** workflow run for the merge commit. It
   waits for the Workers Build, then checks the landing JavaScript and
   Lighthouse on production. It never blocks a merge; a failure means a
   budget in `docs/PERFORMANCE.md` slipped.

## Record the evidence

A deploy is done only when its evidence is in `docs/STATUS.md`:

- Add a row at the top of the verification snapshot: the commit and Worker
  version, URL, UTC time, build ID, and what was checked.
- Update "Last known deployed commit".
- Fill in the production row of the change record's deployment table, and
  add its production evidence.

Record the evidence in the next feature's pull request, not in a pull
request of its own: each feature ships in one pull request, which also
carries the previous deploy's evidence. Tell the person the deploy passed
right away. Open a docs-only pull request for evidence only when no feature
work follows, or when `main` needs the record sooner, for example before an
outside test or the launch.

A docs-only merge also deploys; its evidence need not be recorded unless it
changed what production serves.

## When it fails

- **Build failed before deploy:** reproduce with `pnpm verify` and
  `pnpm cf:dry-run:production`, fix, and open a new pull request.
- **Post-deploy smoke failed:** the new version stays live. Roll back to the
  last healthy version, then fix and redeploy:

  ```sh
  pnpm exec wrangler deployments list --env production
  pnpm exec wrangler rollback <previous-version-id> --env production
  ```

  A rollback does not restore D1 or any other stored data.

- **Migration failed:** do not deploy code. Understand the migration's state
  first.
- **A location still serves the old version:** some locations lag by a minute
  or more. The post-deploy smoke waits for `/api/health` to report the new
  version; wait the same way before judging.

Rollbacks and manual deploys change live state. Confirm with the person
before running them.
