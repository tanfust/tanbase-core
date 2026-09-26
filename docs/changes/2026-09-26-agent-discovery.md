---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# 2026-09-26: Agent discovery for the MCP server

## Summary

The Worker now negotiates Markdown for the homepage, stops answering non-HTML
page requests with a 500, and publishes discovery documents for the F-015 MCP
server: an RFC 9727 API catalog, an AI Catalog, the MCP server card, and an
agent skills index with a product skill. Pages offer the task tools to
in-browser agents through WebMCP
([ADR-0015](../decisions/0015-worker-served-agent-discovery.md)).

## Motivation

A readiness scan of `core.tanbase.dev` on 2026-09-26 reported Markdown
negotiation, the API catalog, and the ARD manifest as HTTP 500, and no MCP
server card, skills index, or WebMCP tools. The 500s came from TanStack
Start, which rejects page requests whose `Accept` header rules out HTML, not
from the zone plan. F-015 made the gated capabilities real, so the metadata
could now be published truthfully. `llms.txt` still said there was no MCP
endpoint or authorization server.

## Behavior and configuration changes

- `src/server.ts` routes through one `route()` function: CORS preflights,
  `/mcp`, realtime upgrades, OAuth discovery, agent discovery, then Markdown
  pages, before TanStack Start.
- `src/modules/seo/negotiation.ts`: `/` returns Markdown to clients that name
  `text/markdown` at least as highly as `text/html`, with `Vary: Accept`,
  `Content-Signal`, and `x-markdown-tokens`. Page requests that rule HTML out
  reach TanStack Start as `Accept: text/html`; API routes and server functions
  are untouched. The HTML homepage also sends `Vary: Accept` and a
  `rel="api-catalog"` link.
- `src/modules/seo/homepage.ts` holds the homepage copy for both the page and
  its Markdown.
- `src/modules/discovery/` serves `/.well-known/api-catalog`,
  `/.well-known/ai-catalog.json` and `/.well-known/ard.json`,
  `/mcp/server-card`, `/.well-known/mcp/server-card.json`,
  `/.well-known/agent-skills/index.json`, and the `tanbase-tasks` skill, with
  CORS, `ETag`, `304`, `HEAD`, and `405` handling.
- `src/modules/mcp/tool-definitions.ts` defines the three tools once for
  `/mcp`, the server card, and WebMCP. It sets zod to `jitless` with English
  messages: the CSP blocks eval, and client builds drop zod's default locale.
- WebMCP: `src/components/web-mcp.tsx` registers the tools on every page when
  the browser exposes `document.modelContext` or `navigator.modelContext`,
  loading `src/modules/mcp/web-mcp.ts` only then. The tools call new
  session-scoped server functions in `src/modules/mcp/browser-tools.ts`.
- `llms.txt` lists the agent entry points and the current limits.
- Smoke checks Markdown negotiation on every run, a 404 for a missing page
  requested as JSON, and every discovery document. `--expect-markdown` is gone.
- `scripts/prepare-e2e-account.mjs` adds a second verified account for the new
  `e2e/web-mcp.spec.ts`.

## Migrations and environment changes

No migrations, bindings, variables, or secrets. `src/worker-configuration.d.ts`
is unchanged. DNS-AID needs two operator steps in the Cloudflare dashboard,
enabling DNSSEC and adding one SVCB record, described in
[Agent discovery](../AGENT_DISCOVERY.md#dns-aid).

## Validation evidence

Local:

- `pnpm verify` — passed, with `.dev.vars` moved aside as in CI.
- `src/modules/seo/negotiation.test.ts` and `discovery.test.ts` — 33 tests:
  Markdown preference by quality, the HTML rewrite and its exclusions, the
  Markdown response and `HEAD`, the homepage Markdown, and the discovery
  headers.
- `src/modules/discovery/discovery.test.ts` — 21 tests: the card schema rules;
  protocol versions against the SDK; the draft-path card against the running
  server's `initialize` and `tools/list`; the linkset shape; AI Catalog URNs,
  references, and query counts; skill digests over the served bytes; and
  content types, CORS, `ETag`/`304`, `HEAD`, preflight, and `405`.
- `src/components/web-mcp.ui.test.tsx` — 12 tests: `modelContext` detection,
  schemas and annotations, results and errors, invalid input, abort and handle
  unregistration, failed registrations, and mount and unmount.
- `e2e/web-mcp.spec.ts` — passed: tools registered on `/` before sign-in and
  refused with the sign-in message; after sign-in `create_task`,
  `list_tasks`, and `complete_task` worked and the open board showed the task
  in Todo, then Done.
- `pnpm smoke -- --url http://localhost:3000 --environment local` — passed
  against the dev server, and against `pnpm build` plus `vite preview` on
  port 4181.
- Under the enforcing CSP of the preview build, the WebMCP chunk loaded and
  registered all three tools with zero CSP violations, and validation errors
  read `Too small: expected number to be >=1`.

Production: pending deployment.

## Deployment state

| Target     | Commit                          | URL                                              | Date       | Result  |
| ---------- | ------------------------------- | ------------------------------------------------ | ---------- | ------- |
| Local      | Working tree based on `65bd6c6` | `http://localhost:3000`, `http://localhost:4181` | 2026-09-26 | Passed  |
| Production | —                               | `https://core.tanbase.dev`                       | —          | Pending |

## Rollback notes

Revert the change. No data or configuration depends on it. If DNS-AID was
published, delete the SVCB record; leave DNSSEC on, since it protects the
whole zone.

## Remaining work

- Deploy, pass production smoke, and rerun the readiness scan.
- Operator: enable DNSSEC on `tanbase.dev` and publish the DNS-AID record.
- The root protected resource metadata keeps failing strict RFC 9728 checks by
  design, and auth.md stays unpublished; both are recorded in ADR-0015.
