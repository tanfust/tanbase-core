---
status: accepted
audience: contributors, maintainers, agents
last_verified: 2026-09-19
---

# ADR-0006: D1 as the Better Auth session store

## Context

The original roadmap proposed Cloudflare KV as Better Auth secondary storage.
Better Auth 1.7 requires a secondary store to atomically consume a value and to
atomically increment fixed-window counters. Cloudflare documents KV as
eventually consistent and explicitly does not provide atomic operations across
keys or concurrent writers. A read followed by a delete or put would not meet
the authentication contract.

References:

- [Better Auth secondary storage](https://better-auth.com/docs/concepts/database#secondary-storage)
- [Cloudflare KV consistency model](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

## Decision

Better Auth uses the request-scoped Drizzle D1 adapter for users, accounts,
sessions, and verification state. TanBase Core does not configure KV for auth.
The auth instance is created per request, and `tanstackStartCookies()` remains
the final plugin.

## Consequences

The default template has one fewer resource and one authoritative auth store.
Session reads consume D1 operations instead of KV operations. Authentication
does not claim atomic behavior that its storage cannot supply. A future cache
may be added only if its invalidation and Better Auth contract are proven with
the current platform.

## Alternatives

- A KV adapter implemented with `get` followed by `delete` or `put` was
  rejected because those sequences are not atomic.
- A Durable Object could provide strong serialized operations, but it adds an
  unnecessary resource before measured auth traffic justifies it.
- Cookie-only sessions were rejected because the product requires server-side
  revocation and authoritative session records.
