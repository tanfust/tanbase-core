---
status: active
audience: users, contributors, operators, agents
last_verified: 2026-09-24
---

# Guided installation

TanBase includes a resumable installer for a fresh clone. It prepares isolated
local development and, by default, creates the essential production resources
in the selected Cloudflare account.

## Fast path

Prerequisites:

- Node.js `^22.13.0` or `>=24.0.0`
- pnpm `10.11.1`
- A Cloudflare account for production setup

Run:

```sh
pnpm install --frozen-lockfile
pnpm run setup
```

`setup` is a reserved command in pnpm itself, so the package script must be
invoked as `pnpm run setup`. The installer shows one plan and confirmation,
then advances automatically. For non-interactive safe defaults:

```sh
pnpm run setup --yes --account-id <cloudflare-account-id>
```

Use `pnpm run setup --dry-run` to print the plan without changing local or
remote state. Use `pnpm run setup --local-only` when Cloudflare deployment is
not wanted yet.

## What the installer configures

The full setup:

1. Authenticates Wrangler and resolves one Cloudflare account.
2. Creates or safely reuses `<worker-name>-production` in D1 and the
   `<worker-name>-files` R2 bucket. When R2 is not enabled for the account, it
   removes the production `FILES` binding so the deployment succeeds with
   attachments off; enable R2 and run setup again to add them. The live
   board's Durable Object needs no setup: deployment creates it.
3. Personalizes the Worker name, account ID, D1 IDs, Better Auth URL, and
   canonical discovery origin. It keeps the production Turnstile site key only
   when the Worker already has `TURNSTILE_SECRET_KEY`; otherwise it clears the
   key, which disables the auth challenge instead of failing closed. It keeps
   the production `EMAIL` binding and sender only when the sender's Email
   Sending domain is onboarded and enabled in the account; otherwise it removes
   them so email is logged as metadata and the deployment succeeds.
4. Creates an ignored local Better Auth secret and adds Cloudflare's Turnstile
   test secret, applies local migrations, and runs the idempotent local seed.
5. Regenerates Worker types and runs `pnpm verify` plus the production dry run.
6. Applies production D1 migrations before deploying application code.
7. Generates `BETTER_AUTH_SECRET` when the Worker does not already have it and
   uploads it from a temporary permission-restricted file.
8. Deploys, reconciles the real `workers.dev` URL, rebuilds when needed, and
   runs the production smoke suite.
9. Writes non-secret resume information to ignored
   `.tanbase/setup-state.json`.

The script never deletes resources, prints secrets, stores production secrets,
or silently reuses an unknown same-named Worker or database. A rerun inspects
Cloudflare again and resumes completed work.

## Options

| Option                 | Behavior                                                        |
| ---------------------- | --------------------------------------------------------------- |
| `--account-id <id>`    | Select an account when the login can access several             |
| `--name <worker-name>` | Override the directory-derived Worker name                      |
| `--reuse-existing`     | Explicitly authorize same-named Worker and D1 reuse             |
| `--local-only`         | Prepare local D1, secrets, types, and verification only         |
| `--yes`, `-y`          | Accept safe defaults; ambiguity and collisions still stop setup |
| `--dry-run`            | Print the plan without changes                                  |

## Intentionally skipped

The default path excludes Cloudflare Email Service domain onboarding, Turnstile
widget creation, a custom domain, Workers Builds Git integration, preview deployments,
and future optional bindings. The setup summary states whether Turnstile is
enabled; see the [deployment runbook](DEPLOYMENT.md) to enable it. The application logs safe email metadata while `EMAIL_FROM` is empty,
so Email Service cannot block a fresh deployment.

After installation, review and commit `wrangler.jsonc`, the generated Worker
types, and canonical URL changes so later Workers Builds use the same resources.
Do not commit `.dev.vars` or `.tanbase/`.

## Recovery

When setup stops, read the error, correct the condition, and run the same
command again. Created Cloudflare resources and safe checkpoints are preserved.
Use `--reuse-existing` only after confirming that a reported Worker or D1
database belongs to this installation.
