---
status: accepted
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# ADR-0016: A deployment works without personalization

## Context

F-023 asks for a Deploy to Cloudflare button. The button clones the
repository, provisions resources, and deploys the Wrangler configuration as
committed. It cannot run the guided installer, which today rewrites the
public origin in `BETTER_AUTH_URL`, `src/lib/site.ts`, and `llms.txt` for each
installation.

Two things broke a deployment that skipped that step:

- Canonical URLs, the sitemap, robots, discovery links, the Markdown
  homepage, JSON-LD, and `llms.txt` named `core.tanbase.dev`, compiled in.
  Better Auth, MCP, and the attachment and realtime origin checks read
  `BETTER_AUTH_URL`, which a fresh deployment cannot know before it has a
  URL.
- Sign-up always required email verification. A fresh Cloudflare account has
  no Email Sending domain, so no one could finish signing up.

## Decision

- **The public origin is resolved at runtime.** `publicOrigin()` in
  `src/platform/origin.ts` returns `BETTER_AUTH_URL` when an installation pins
  one, and otherwise the origin the request arrived on. Every consumer uses
  it: Better Auth, MCP identifiers, discovery documents, origin checks,
  canonical URLs, the sitemap, robots, discovery links, the Markdown homepage,
  JSON-LD, and `llms.txt`. A value that is set but is not a URL fails closed.
  Queue and cron handlers have no request, so due-date reminders need
  `BETTER_AUTH_URL` and are skipped, unclaimed, without it.
- **Email verification follows email delivery.** When the `EMAIL` binding and
  `EMAIL_FROM` are both set, new accounts must verify their address, as
  before. Without them, new accounts sign in straight away, and the reset page
  says reset links cannot be emailed.

`src/lib/site.ts` keeps `siteConfig.origin` only as the TanBase demo's own
origin: the default target of `pnpm smoke --environment production`.

## Consequences

- A fork can deploy with no origin configured and get correct links on its
  `workers.dev` URL. An installation that serves several hostnames, such as
  `workers.dev` and a custom domain, should set `BETTER_AUTH_URL`, so
  canonical URLs, cookies, and tokens settle on one origin.
- Without email, sign-up is unverified: it can reveal whether an address
  already has an account, and anyone can register any address. That suits a
  first deployment or a private fork. Configure Email Service before a
  public launch.
- Reminders go only to verified users, so a deployment without email never
  queues any.
- Production is unchanged: TanBase pins `BETTER_AUTH_URL` and has email
  delivery.

## Alternatives

- **Require personalization before deploy.** This keeps one code path, but a
  button deploy cannot satisfy it.
- **Log verification links when email is off.** That would let an operator
  finish sign-up by hand, but it writes one-time tokens to logs, which
  `AGENTS.md` forbids.
- **Resolve the origin on the client.** Pages could read
  `window.location.origin`, but server-rendered head tags, feeds, and auth
  need it on the server, and one resolver keeps them consistent.
