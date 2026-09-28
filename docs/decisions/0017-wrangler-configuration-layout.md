---
status: accepted
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# ADR-0017: A generic top-level Wrangler configuration

[ADR-0021](0021-deploy-binds-r2-and-creates-the-auth-secret.md) replaces two
parts of this decision: the top level no longer declares the R2 binding,
which `pnpm run deploy` adds when the account has R2, and `.dev.vars.example`
is gone, since the first deploy creates `BETTER_AUTH_SECRET`.

## Context

The Deploy to Cloudflare button reads the top level of `wrangler.jsonc`,
creates the resources it names, and deploys it with Workers Builds. It
ignores named environments.

Until now the top level was local development: `APP_ENV=local`, a localhost
auth URL, the Turnstile test key, and `-local` resource names. The deployable
configuration lived under `env.production`, pinned to the TanBase demo's
database, domain, sender, Turnstile widget, and placement. A button deploy
would have run as local development.

[ADR-0016](0016-deploy-without-personalization.md) made the Worker work
without an origin or email. The configuration still has to be deployable
without editing.

## Decision

`wrangler.jsonc` has three sections:

- **Top level: a generic production configuration.** It sets
  `APP_ENV=production`, empty `BETTER_AUTH_URL`, `EMAIL_FROM`,
  `TURNSTILE_SITE_KEY`, and `POSTHOG_HOST`, and every binding with a default
  name and no account-specific ID. It has no `EMAIL` binding and no
  placement hint. The button, `pnpm build`, and `pnpm run deploy` use it.
- **`env.local`: local development.** It holds the previous top level
  unchanged, including the `-local` names and the Turnstile test key, and has
  no `AI` binding. `vite dev` selects it when no environment is named, and the
  local database scripts and the Worker tests name it.
- **`env.production`: a pinned installation.** It stays the TanBase demo,
  and the guided installer rewrites it for yours. TanBase's Workers Build
  keeps deploying it with `pnpm cf:deploy:production`.

`pnpm run deploy` applies D1 migrations and deploys the top level.
`package.json` describes each setting for the button's setup page, and
`.dev.vars.example` lists the one secret the button must ask for,
`BETTER_AUTH_SECRET`. CI dry-runs the top level on every push.

## Consequences

- A fork deploys with one click, and each new binding is declared in all
  three sections.
- The top level and `env.production` both name the Worker `tanbase-core`, so
  deploying the top level from the TanBase account would replace the demo's
  production Worker. `pnpm run deploy` refuses to run in the upstream
  checkout; production deploys only through Workers Builds.
- A button fork has sign-up without verification and no bot challenge until
  it configures email and Turnstile. The DEPLOYMENT runbook lists the steps.
- `pnpm build` now builds the generic production configuration. A local
  `pnpm preview` of it therefore runs as production with the request's origin.

## Alternatives

- **Keep the layout and skip the button.** The guided installer already
  deploys in one command, but it needs Node.js, pnpm, and a Wrangler login,
  and the button needs only a browser.
- **A generated deploy branch.** CI could publish a button-ready copy of
  `wrangler.jsonc` on a separate branch, but the branch would drift from
  `main` and be a second thing to maintain.
- **Local development from `.dev.vars` overrides of the top level.** Variables
  can be overridden that way, but bindings cannot, and the top-level `AI`
  binding would make `pnpm dev` call Workers AI remotely.
