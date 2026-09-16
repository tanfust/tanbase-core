---
status: accepted
audience: contributors, maintainers, agents
last_verified: 2026-09-16
---

# ADR-0003: Documentation source hierarchy

## Context

An open-source template accumulates active guides, decisions, and historical
change notes. Developers and AI agents need a deterministic way to resolve stale
or conflicting statements.

## Decision

Truth is resolved in this order: current code and configuration; active
architecture and runbooks; accepted, non-superseded ADRs; historical change
notes. `AGENTS.md` is the concise operating contract and required reading order.
Maintained Markdown documents carry status, audience, and last-verified metadata.

## Consequences

Historical notes can remain immutable without misleading future work. Active
guides must be updated when behavior changes. Documentation checks catch missing
metadata, required record sections, and broken internal links.

## Alternatives

A single large README was rejected because it mixes audiences and changes too
often. Treating change notes as living documentation was rejected because it
erases implementation history and creates ambiguous current truth.
