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

Production:

- Workers Build `17dc0246` deployed merge `244e2ea` as version `217220f7`
  at 19:31 UTC; there were no migrations to apply, and post-deploy smoke passed
  on the first attempt.
- The operator reconnected Claude. Since the deployment `/mcp` has answered
  `200` eight times and `401` twice (the unauthenticated challenge), with no
  `500`; the previous version returned `500` twelve times. Claude's requests
  took 48 to 95 ms of Worker time.
- A `list_tasks` call through the Claude connector from a separate session
  succeeded.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------ |
| Local      | Working tree based on `131393d` | —                          | 2026-09-26 | Passed |
| Production | `244e2ea` / version `217220f7`  | `https://core.tanbase.dev` | 2026-09-26 | Passed |

## Rollback notes

Revert this change; `/mcp` then fails for authenticated requests again.

## Remaining work

- None for this fix.
