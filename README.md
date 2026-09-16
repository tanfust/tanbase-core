# TanBase Core

**The whole Cloudflare stack, wired together, for $5 a month.**

An open-source starter for TanStack Start. One Worker runs your database, auth, files, realtime, background jobs, AI and an MCP server. A working app proves it all fits together.

> **Status: in development.** Nothing here is ready to deploy yet. Watch the repo to follow the build, milestone by milestone. See the [roadmap](#11-roadmap).

[Demo](#03-the-demo) (at launch) · [Docs](docs/OVERVIEW.md) · [Roadmap](#11-roadmap) · [Tanfust](https://tanfust.com)

---

## [01] Why

Every side project costs a subscription before it has a single user.

Hosted backends bill per project. Run five small apps and you either pay five times or let them go to sleep. Cloudflare bills per account, on usage, and scales to zero. One $5 plan can run all of them.

The hard part is the wiring. Most templates stop at auth and a database. TanBase Core wires in everything else and proves it with a real app, running in production, with the invoice published.

## [02] What you get

| You need | Core uses |
|---|---|
| Server-rendered React, server functions | TanStack Start on Cloudflare Workers |
| A database | D1 + Drizzle ORM |
| Sign in: email, magic link, Google | Better Auth on D1, sessions in KV |
| Bot protection | Turnstile |
| Abuse limits | Rate Limiting |
| File uploads | R2 |
| Live updates across devices | Durable Objects with WebSocket Hibernation |
| Multi-step background work | Workflows |
| Scheduled jobs | Cron Triggers + Queues |
| AI | Workers AI through AI Gateway |
| Email | React Email + Resend |
| Agent access to your app | MCP server (Cloudflare Agents SDK) |
| The boring production layer | SEO, OG images, security headers, error pages, logs, CI with preview deploys |

All of it deploys as one Worker from one `wrangler.jsonc`.

## [03] The demo

A task board. Every primitive in the repo powers a feature in it. Nothing is there for show.

1. Sign up with email, a magic link or Google.
2. Create tasks, drag them across columns, set due dates.
3. Open the board on your phone. Changes appear live.
4. Attach files to a task.
5. Click **Break down**. AI splits the task into subtasks while you watch.
6. Get an email before a task is due.
7. Connect Claude and ask what is due today.

The public demo resets every night.

## [04] Cost

Core targets the **Workers Paid plan at $5 a month**. At indie scale, usage stays inside what the plan includes.

| Product | Included per month |
|---|---|
| Workers | 10M requests, 30M CPU milliseconds |
| D1 | 25B rows read, 50M rows written, 5 GB storage |
| Durable Objects | 1M requests, 400K GB-seconds |
| Workers AI | Free daily allocation, then per-model pricing |
| R2 | No egress fees |

Allowances checked September 2026. Confirm on [Cloudflare's pricing page](https://developers.cloudflare.com/workers/platform/pricing/) before you rely on them. Resend's free tier covers 3,000 emails a month.

**What can cost more:** AI usage beyond the free daily allocation, and abuse of anything public. Core ships guardrails for both: Turnstile, rate limits, a per-user daily AI quota, an upload size cap, and billing alerts.

**Proof, not promises.** After 30 days of public demo, the real invoice goes here.

## [05] Stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start, TanStack Router, TanStack Query |
| Runtime | Cloudflare Workers, Wrangler, `@cloudflare/vite-plugin` |
| UI | Tailwind CSS v4, shadcn/ui |
| Data | D1, Drizzle ORM, Zod |
| Auth | Better Auth |
| Email | React Email, Resend |
| Testing | Vitest (Workers pool), Playwright |
| Package manager | pnpm |

## [06] Quick start

*Planned for v0.1. Commands may change until then.*

```bash
git clone https://github.com/tanfust/tanbase-core.git my-app
cd my-app
pnpm install
cp .dev.vars.example .dev.vars   # every key is documented
pnpm db:migrate:local
pnpm dev
```

Deploy with the **Deploy to Cloudflare** button, or:

```bash
pnpm setup    # creates D1, KV, R2 and queues, applies migrations
pnpm deploy
```

Goal: from this README to your own deployed copy in under 15 minutes.

## [07] Take what you need

Each primitive lives in its own module: a folder, a binding and an export.

```
src/modules/
  auth/       tasks/      files/
  realtime/   jobs/       email/
  ai/         mcp/        seo/
```

Don't need realtime? Delete the module, remove its binding and its export. The steps for every optional module are documented and verified, so a smaller app starts from a smaller repo.

## [08] Built for agents

Core is written to be read by coding agents as much as by people.

- `AGENTS.md` covers the stack, the module map, the rules and the commands.
- `.claude/skills/` holds skills to add a module, add a table, remove a module and deploy.
- `llms.txt` describes the project for any model.
- The MCP server lets agents work with your app's data, not just its code.

## [09] Principles

1. **Every primitive earns its place.** If no feature needs it, it is not in the repo.
2. **One Worker.** One config, one deploy, one entry file.
3. **Modules are deletable.** Removing one is documented and verified.
4. **Ownership lives in code.** Every query goes through a repository that requires a user id.
5. **D1 is the source of truth.** Durable Objects broadcast changes. They never store app data.
6. **Measured, not claimed.** Performance budgets and cost are checked against real numbers.

## [10] Not included

On purpose, for v1: billing and payments, organizations and teams, shared boards, vector search, internationalization, native mobile.

## [11] Roadmap

- [ ] **1. Skeleton.** Every binding deployed together in one Worker, CI and preview deploys
- [ ] **2. Auth and tasks.** Data layer, email, sign in, the board
- [ ] **3. Files.** Attachments on R2
- [ ] **4. Realtime.** Live board on Durable Objects
- [ ] **5. Jobs.** Due-date reminders through Cron and Queues
- [ ] **6. AI.** Task breakdown with Workflows and Workers AI
- [ ] **7. MCP.** Your tasks, available to agents
- [ ] **8. Launch.** SEO, hardening, agent docs, one-click deploy, public demo

Full backlog with acceptance criteria: [`docs/FEATURES.md`](docs/FEATURES.md).

## [12] Contributing

Issues and pull requests are welcome.

One rule keeps Core small: **a pull request that adds a dependency or a primitive must include the demo feature that uses it.** Open an issue first for anything larger than a fix.

## License

[MIT](LICENSE). Use it for anything, including commercial work.

---

Built in Tunis by [Tanfust](https://tanfust.com). Tools for doers.
