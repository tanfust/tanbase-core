---
title: Why TanBase Core
description: A task board that proves the whole stack works. What TanBase Core is, why every Cloudflare primitive in it powers a real feature, and what a fork gets on day one.
date: 2026-09-27
author: Tanfust
tags: [tanstack, cloudflare-workers, open-source]
---

TanBase Core is an open-source TanStack Start foundation for Cloudflare
Workers. It ships auth, data, files, realtime, jobs, AI, and an MCP server in
one Worker that you fork and own. The app itself is a task board, and the
board is the point: it proves that the whole stack works together, in
production, before you build anything of your own on it.

## Not a bare template

Most starters stop at a folder structure and a list of integrations. You find
out later which parts were ever run against real traffic. TanBase Core takes
the opposite rule: a Cloudflare primitive enters the repository only with a
feature that uses it. Each one powers part of the board, runs in production
on [core.tanbase.dev](https://core.tanbase.dev), and has tests and docs.

- **D1 with Drizzle** stores projects and tasks, behind repositories that
  scope every query to its owner.
- **Better Auth on D1** handles accounts and sessions, with **Turnstile** and
  **Rate Limiting** in front of sign-up and sign-in.
- **R2** holds task attachments.
- **Durable Objects** relay board changes between devices over WebSockets
  that hibernate between events.
- **Cron Triggers and Queues** send due-date reminders, each one at most once.
- **Workflows and Workers AI**, through AI Gateway, break a task into
  subtasks behind a per-user daily quota.
- **An MCP server** at `/mcp` lets Claude and other agents list, create, and
  complete tasks after signing in with OAuth 2.1.
- **Workers Caching** keeps the link preview images, which the Worker draws
  itself, until the next deploy.

## One Worker

Everything runs in the same Worker: server rendering, static assets, the cron
handler, the queue consumer, the Workflow, and the Durable Object ship in one
deploy. There is no second service to keep in step, and the local
development server runs the same Workers runtime as production.

Production runs next to its D1 primary through a placement hint, so server
functions stay fast even when a request enters Cloudflare far away.

## TanStack from end to end

TanStack Start renders every page on the Worker, and TanStack Router and
TanStack Query carry the data from the server to the board. The same rule
applies to the rest of the TanStack libraries in the app:

- **TanStack Form** drives every form, validating with the same Zod schemas
  that the server applies.
- **TanStack Table** powers the board's list view. Its sort, filters, search,
  and columns live in the URL, so a view can be shared as a link.
- **TanStack Charts** draws each project's weekly activity.
- **TanStack Markdown** renders this blog. Posts are Markdown files in the
  repository, compiled on the Worker, with no database and no CMS.

## What it costs

The target is the public demo on Workers Paid at $5 a month, with its usage
inside the plan's included allowances. Static assets and egress are free.
Every deployment needs Workers Paid, because password sign-in and drawing a
preview image take more CPU per request than Workers Free allows.

What could push it past $5 is Workers AI beyond the free daily Neurons, and
abuse of the public demo. So the guardrails run from the start: Turnstile and
per-IP rate limits on auth, a per-user daily AI quota, and a 10 MB upload cap
with an allowlist of file types.

## Keep what you need

A foundation you cannot take apart is a liability. Attachments, the live
board, reminders, AI, MCP, preview images, and this blog are each optional.
The
[module removal guide](https://github.com/tanfust/tanbase-core/blob/main/docs/MODULE_REMOVAL.md)
lists every file to change and the cloud resources left behind, and every
removal it describes was carried out once, with its checks green, before it
was written down.

## Built for agents too

The repository has an operating contract for AI agents in `AGENTS.md`, and
skills for the common tasks: adding a table, adding or removing a module, and
deploying. A fresh agent session, given only those docs, added a new table
with its repository, server functions, and tests in about nine minutes.

The deployed app is agent-ready as well. It publishes an API catalog, an MCP
server card, and an agent skill, and its pages register the task tools
through WebMCP.

## Try it

Open the [live demo](https://core.tanbase.dev) and create an account. To run
your own, use the Deploy to Cloudflare button in the
[README](https://github.com/tanfust/tanbase-core#quick-start), or clone the
repository and run the guided installer:

```sh
pnpm install --frozen-lockfile
pnpm run setup
```

It prepares local development, provisions D1, configures auth, deploys to
Cloudflare, and runs the production smoke checks. Then make it yours: the
app's name, logo, and icons live in one file, `src/lib/site.ts`.
