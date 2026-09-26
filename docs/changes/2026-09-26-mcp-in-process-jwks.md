---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# 2026-09-26: Verify MCP access tokens with in-process keys

## Summary

`/mcp` now verifies access tokens against the public keys read in-process,
instead of fetching `/api/auth/jwks` over the network.

## Motivation

After [the MCP server](2026-09-26-mcp-server.md) deployed in version
`8dd843f7`, Claude completed registration, sign-in, consent, and the token
exchange, then every authenticated `POST /mcp` returned `500`. Worker logs
showed `Jwks failed` and no request to `/api/auth/jwks`: the Worker's fetch to
its own hostname never reached it. Local runs passed because the local runtime
can reach its own dev server.

## Behavior and configuration changes

- `handleMcpRequest` passes `requireMcpAuth` a function that returns
  `auth.api.getJwks()`. The verifier's underlying `jwksFetch` accepts a
  function, and `requireMcpAuth` forwards `jwksUrl` to it; a type cast bridges
  the declared `string` type. Issuer, audience, expiry, DPoP, and challenges
  are unchanged.
- [ADR-0014](../decisions/0014-mcp-oauth-with-better-auth.md) is amended.

## Migrations and environment changes

None.

## Validation evidence

Local:

- New test: the full OAuth flow in-process (a verified user, registration,
  sign-in, authorization, consent, and a PKCE token exchange), then
  `create_task` over `/mcp` with the real access token while any fetch to the
  app's own origin throws. It passes with this change and fails without it
  with `Self-fetch: http://localhost:3000/api/auth/jwks`.
- `pnpm verify` — passed.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result       |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------------ |
| Local      | Working tree based on `131393d` | —                          | 2026-09-26 | Passed       |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert this change; `/mcp` then fails for authenticated requests again.

## Remaining work

- Connect Claude to `https://core.tanbase.dev/mcp` after deployment.
