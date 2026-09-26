---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# ADR-0014: MCP over OAuth 2.1 with Better Auth and the official MCP SDK

## Context

F-015 adds a remote MCP server at `/mcp` so Claude and other MCP clients can
list, create, and complete a user's tasks. Open question 1 asked whether
clients authenticate with OAuth through Better Auth or with personal access
tokens. Claude's custom connectors sign users in with OAuth, discovering the
authorization server from the resource's metadata; they do not accept a
pasted token. Better Auth 1.7.6 ships `@better-auth/mcp`, an OAuth 2.1
provider profiled for MCP, and the official MCP TypeScript SDK v2 serves the
stateless 2026-07-28 protocol and stateless 2025-era clients over a
web-standard `fetch` handler.

## Decision

- Better Auth is the authorization server. The `jwt()` and `mcp()` plugins
  issue JWT access tokens (1 hour) and refresh tokens (30 days) bound to the
  `${BETTER_AUTH_URL}/mcp` audience, after the user signs in on `/login` and
  approves the client on `/oauth/consent`.
- `/mcp` is wrapped in `requireMcpAuth`, which verifies the signature against
  the app's own JWKS, the issuer, audience, expiry, and DPoP when a token is
  bound, and answers unauthenticated requests with the RFC 9728 challenge.
  The JWKS is fetched from the app's own Custom Domain, which Workers allow,
  and cached per isolate.
- Clients register with unauthenticated Dynamic Client Registration, limited
  by `AUTH_LIMITER` to 10 registrations per IP per minute. Client ID Metadata
  Documents are not enabled: Better Auth requires a fetch transport that
  resolves each hostname once, rejects special-use addresses, and pins the
  address, which a Worker cannot do.
- The MCP protocol runs on `@modelcontextprotocol/server` v2's
  `createMcpHandler` with the `@cfworker/json-schema` validator, one server
  per request scoped to the token's subject. The Cloudflare Agents SDK's
  `McpAgent` is not used: a Durable Object per session adds nothing to three
  stateless tools, and `agents` brings a large dependency tree.
- `src/server.ts` serves `/mcp` and the root discovery documents
  (`/.well-known/oauth-protected-resource/mcp`,
  `/.well-known/oauth-authorization-server/api/auth`, and
  `/.well-known/openid-configuration/api/auth`) before TanStack Start, with
  permissive CORS on those cookie-free endpoints for browser-based clients.

## Consequences

Connecting needs no token handling by the user, and every tool acts only as
the approved user through the task repositories. The database gains the eight
provider tables, and signing keys are stored encrypted with
`BETTER_AUTH_SECRET`, so rotating the secret invalidates issued tokens.
Unauthenticated registration lets anyone create client rows within the rate
limit; nothing prunes unused clients yet, and users have no screen to list or
revoke connected clients. Only users who can already sign in can authorize:
signing up mid-flow requires starting the connection again after email
verification. Clients that support only CIMD cannot connect until a
Workers-safe transport exists.

## Alternatives

- Personal access tokens are simpler to build but do not work with Claude's
  connector flow and turn every user into a secret manager.
- `@cloudflare/workers-oauth-provider` with `McpAgent` would run a second
  OAuth server beside Better Auth, duplicating identity and consent.
- CIMD without the address-pinning transport would let clients make the
  Worker fetch arbitrary URLs.
