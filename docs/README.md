---
status: active
audience: users, contributors, maintainers, agents
last_verified: 2026-09-17
---

# Documentation index

## Start here

| Audience             | Read first                    | Purpose                                           |
| -------------------- | ----------------------------- | ------------------------------------------------- |
| Evaluators and users | [README](../README.md)        | Product scope and shortest successful start       |
| Contributors         | [Development](DEVELOPMENT.md) | Setup, commands, tests, and contribution workflow |
| Operators            | [Deployment](DEPLOYMENT.md)   | Preview, production, smoke checks, and rollback   |
| Maintainers          | [Overview](OVERVIEW.md)       | Stable product and architecture truth             |
| Product planning     | [Features](FEATURES.md)       | Roadmap, dependencies, and acceptance criteria    |
| Agents               | [AGENTS](../AGENTS.md)        | Required reading order and operating contract     |

## Current state and history

- [Status](STATUS.md) is a dated snapshot of local, preview, and production
  evidence. GitHub Deployments and Cloudflare remain the operational record.
- [Architecture decisions](decisions/README.md) explain durable choices and
  their consequences.
- [Change records](changes/README.md) preserve implementation history. They do
  not override current code or active guides.

All maintained Markdown documents carry `status`, `audience`, and
`last_verified` frontmatter. Run `pnpm docs:check` after editing documentation.
