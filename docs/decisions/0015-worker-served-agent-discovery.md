---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# ADR-0015: The Worker serves agent discovery and Markdown

## Context

F-015 gave TanBase Core real agent capabilities: an MCP server at `/mcp`, an
OAuth 2.1 authorization server, and a public health endpoint. The discovery
baseline from 2026-09-17 gated the matching metadata on those capabilities,
and a readiness scan on 2026-09-26 still reported most of it missing.

The scan also exposed a bug. TanStack Start answers any page request whose
`Accept` header names neither `*/*` nor `text/html` with a 500
(`Only HTML requests are supported here`). That covered
`Accept: text/markdown` on `/`, which had been blamed on Cloudflare's
Markdown for Agents, and every JSON probe of a missing well-known path.
Markdown for Agents needs a Pro zone, and `tanbase.dev` is on Free.

The specifications are young and moving. The MCP Server Card extension
(SEP-2127, still in review) moved the card from the earlier SEP-1649 draft's
`/.well-known/mcp/server-card.json` to `/mcp/server-card`, and scanners still
read the old path. ARD v0.91 renamed `ai-catalog.json` to `ard.json`. WebMCP
moved from `navigator.modelContext` to `document.modelContext`. auth.md is at
v0.6, and its agent registration needs endpoints this app does not have.

## Decision

- **Negotiation in the Worker.** `src/server.ts` serves a Markdown
  representation of `/` to clients that name `text/markdown` at least as
  highly as `text/html`, with `Vary: Accept`, the Content Signals policy, and
  an estimated `x-markdown-tokens`. The Markdown and the page render from one
  content module. A page request that rules HTML out is passed to TanStack
  Start as `Accept: text/html`, so missing pages return 404 and real pages
  render. API routes and server functions are left alone.
- **Documents derived from code.** `src/modules/discovery/` serves the RFC 9727
  API catalog, the AI Catalog at both ARD names, the MCP server card, and the
  Agent Skills index with one curated product skill. The card's tools and
  server info come from the definitions `/mcp` registers, identifiers derive
  from `BETTER_AUTH_URL`, and the skill digest is computed from the bytes
  served. Each document is public, cacheable for five minutes, and CORS-open.
- **Current specs first, older drafts beside them.** The card at
  `/mcp/server-card` follows SEP-2127 exactly. The draft path serves the same
  card plus the SEP-1649 fields, which stay truthful because they are derived
  from the server. Both ARD names serve one document.
- **WebMCP through the session.** Every page registers `list_tasks`,
  `create_task`, and `complete_task` with `document.modelContext`, falling back
  to `navigator.modelContext`. The tools share schemas with `/mcp`, call server
  functions that act as the signed-in session, and return a sign-in message
  otherwise. The tool code loads only in browsers that expose WebMCP.
- **Not published.** No `auth.md` or `agent_auth` block: every auth.md method
  returns a service-signed identity assertion through `/agent/identity` and a
  JWT-bearer exchange, and TanBase Core only issues tokens to a person who
  signs in and consents. No A2A agent card: there is no A2A agent.
- **Protected resource metadata unchanged.** The root
  `/.well-known/oauth-protected-resource` keeps describing the `/mcp`
  resource, as Better Auth serves it for the MCP specification's root
  fallback. Strict RFC 9728 validators reject that document, because its
  `resource` is not the origin. The path-inserted document is conformant.
- **DNS-AID is operator-owned.** The records and DNSSEC live in the Cloudflare
  zone, outside the repository. [Agent discovery](../AGENT_DISCOVERY.md)
  records the exact records.

## Consequences

Markdown negotiation no longer depends on the zone plan, and non-HTML probes
stop producing 500s. Discovery documents cannot drift from the MCP server,
because they are built from the same definitions and tests compare them with
the running server. The skill and the older-draft paths need maintenance as
the drafts settle. `x-markdown-tokens` is an estimate at four characters a
token. Only `/` has a Markdown representation; other pages fall back to HTML.
Strict RFC 9728 checks of the root protected resource metadata keep failing
until tokens can be issued for an origin-level resource.

## Alternatives

- Upgrading the zone to Pro for Cloudflare's Markdown for Agents costs a paid
  plan for one page and leaves the 500s on other non-HTML requests.
- Converting rendered HTML to Markdown in the Worker would cover every page
  but adds CPU to each request and an HTML parser for pages with little prose.
- Describing the origin as the protected resource would satisfy strict
  validators, but the authorization server cannot issue tokens for it, so the
  document would promise something that fails.
- Implementing auth.md's `service_auth` method would add a second credential
  issuer beside Better Auth for a draft that is still changing.
- Registering WebMCP tools only for signed-in pages hides them from agents
  that could otherwise ask the person to sign in.
