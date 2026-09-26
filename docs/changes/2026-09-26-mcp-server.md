---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# 2026-09-26: MCP server with OAuth 2.1 through Better Auth

## Summary

Added F-015. `/mcp` serves `list_tasks`, `create_task`, and `complete_task` to
MCP clients such as Claude, which sign users in through Better Auth acting as
an OAuth 2.1 authorization server
([ADR-0014](../decisions/0014-mcp-oauth-with-better-auth.md)).

## Motivation

Agent access is the next launch-path feature: users can manage their board
from Claude without copying tokens.

## Behavior and configuration changes

- Dependencies: `better-auth` 1.7.5 → 1.7.6, and new `@better-auth/mcp`,
  `@better-auth/oauth-provider`, and `@modelcontextprotocol/server` 2.1.0.
- Better Auth adds `jwt()` and `mcp()` with `/login` as the login page,
  `/oauth/consent` as the consent page, `${BETTER_AUTH_URL}/mcp` as the
  resource, and unauthenticated Dynamic Client Registration.
  `/oauth2/register` joins the `AUTH_LIMITER` endpoints.
- `src/modules/mcp/`: the tools over the task repositories (with a new
  `listTasksForUser` query), the per-request MCP server with output schemas
  and annotations, `requireMcpAuth` on `/mcp`, the root discovery documents,
  and CORS for the cookie-free OAuth and MCP endpoints.
- `src/server.ts` answers CORS preflights, `/mcp`, and discovery before
  TanStack Start.
- The auth client includes `oauthProviderClient()`, which forwards the
  signed OAuth query. The login page follows the returned URL after sign-in
  when an MCP client sent the user there. The new consent page shows the
  client name, the requested permissions, and the host the user returns to.
- Production and local smoke check the `401` challenge and both discovery
  documents.

## Migrations and environment changes

Migration `0004_great_lila_cheney.sql` adds `jwks`, `oauth_client`,
`oauth_resource`, `oauth_client_resource`, `oauth_refresh_token`,
`oauth_access_token`, `oauth_consent`, and `oauth_client_assertion`; it is
additive and applied by the deploy command. No variable or secret changes.

## Validation evidence

Local:

- `pnpm verify` — passed.
- `src/modules/mcp/mcp.server.test.ts` — 9 tests: owner-scoped listing with
  project, status, and due-date filters; creation in the first or a named
  project with calendar dates and invalid-date errors; completion only by the
  owner; `tools/list` and `tools/call` through the MCP handler, including tool
  errors and schema validation; the `401` challenge; a forged token; and root
  discovery. The rate-limit test covers `/oauth2/register`.
- Scripted OAuth client against the browser-test server: discovery from the
  `401` challenge, registration (`201`), sign-in, authorization to
  `/oauth/consent` with a signed query, consent returning the code and state,
  a PKCE token exchange returning a Bearer JWT with the `/mcp` audience and a
  refresh token, then `initialize`, `tools/list`, `create_task`, `list_tasks`,
  and `complete_task` over `/mcp`.
- Browser: signed out, the authorization URL led to `/login` with the signed
  query intact, sign-in resumed to the consent page, and **Allow** returned to
  the client's callback with the code and state.
- `pnpm smoke -- --url http://localhost:3114 --environment local` — passed.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result       |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------------ |
| Local      | Working tree based on `180d15a` | `http://localhost:3110`    | 2026-09-26 | Passed       |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Roll back the Worker version; the new tables can stay. Removing the plugins
later leaves them unused. Deleting rows from `oauth_client` revokes clients.

## Remaining work

- Connect Claude to `https://core.tanbase.dev/mcp` in production.
- A settings screen to list and revoke connected clients, and pruning of
  unused registrations.
