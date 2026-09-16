---
status: active
audience: maintainers, operators, agents
last_verified: 2026-09-16
---

# Deployment runbook

Preview and production are separate Workers built from the same commit. The
Cloudflare environment is selected during `vite build`, because the Vite plugin
emits flattened environment-specific configuration at build time.

## Required GitHub configuration

Create `preview` and `production` GitHub environments. Each environment holds:

- Secret `CLOUDFLARE_ACCOUNT_ID`
- Secret `CLOUDFLARE_API_TOKEN`
- Variable `APP_URL`, including `https://`

Use least-privilege Cloudflare tokens. Configure required reviewers on the
`production` environment; workflow YAML cannot create or enforce that rule.
Never store credentials in this repository.

Worker names are fixed:

- Preview: `tanbase-core-preview`
- Production: `tanbase-core`

## Local gates

```sh
pnpm install --frozen-lockfile --trust-lockfile
pnpm verify
pnpm cf:typegen
git diff --exit-code -- src/worker-configuration.d.ts
pnpm cf:dry-run:preview
pnpm cf:dry-run:production
```

## Automated flow

On a push to `main`, `.github/workflows/deploy.yml`:

1. Checks out the triggering commit and verifies it.
2. Builds and deploys the preview Worker.
3. Runs the remote preview smoke test.
4. Stops before production if any preview step fails.
5. Waits for approval through the protected `production` environment.
6. Checks out the same commit, rebuilds for production, deploys, and smokes it.

Environment selection belongs in the build commands:

```sh
pnpm cf:deploy:preview
pnpm cf:deploy:production
```

Do not build once and switch environments afterward.

## Smoke checks

```sh
pnpm smoke -- --url https://preview.example.com --environment preview
pnpm smoke -- --url https://example.com --environment production
```

The script checks the exact health schema and environment, `Cache-Control:
no-store`, root SSR document HTML, head content, hydration scripts, and absence
of a server-error page.

After the first successful deployment, update [status](STATUS.md) and the
[foundation change record](changes/2026-09-16-cloudflare-foundation.md) with the
commit SHA, URL, UTC date, and smoke result. Keep each target separate.

## Rollback

Prefer Cloudflare's deployment rollback to restore the last known healthy
version quickly. Then revert the faulty repository commit, allow preview to
deploy and pass smoke checks, and approve production only after the repaired
commit is healthy. Record both the rollback and the repaired deployment.

If configuration changed, roll back code and configuration together. Never run
an old bundle against newly introduced bindings unless its compatibility was
explicitly verified.

## Recovery

- Build failure: reproduce with the environment-specific build, fix, and rerun
  the dry run. Do not approve production.
- Deploy failure: inspect Wrangler and Cloudflare deployment logs without
  copying tokens into an issue or change record.
- Smoke failure: preserve the failed deployment evidence, inspect Worker logs,
  and roll back if the target previously served a healthy release.
- Generated-type drift: run `pnpm cf:typegen`, review and commit the result.

References: [TanStack Start on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/),
[Cloudflare build environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/),
and [GitHub Actions requirements](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
