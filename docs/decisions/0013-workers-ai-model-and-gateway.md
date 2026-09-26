---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# ADR-0013: Workers AI model and gateway for task breakdown

## Context

F-013 and F-014 break a task into 3 to 7 subtasks with Workers AI. Open
question 3 asked which model returns valid subtask JSON reliably at the lowest
cost. The Workers AI binding only runs remotely, so it also shapes local
development and tests: a remote binding needs Cloudflare credentials, which
forks, CI, and `pnpm dev` without a login do not have.

On 2026-09-26 the current text-generation catalog was benchmarked through the
account's Workers AI API with the production prompt and JSON Schema
(`response_format: json_schema`), 15 tasks per model in English, French, and
Arabic, including a vague task, long notes, and a prompt-injection attempt.
Replies were validated with the same Zod schema the workflow uses.

| Model                                          | Valid | p50 latency | Cost per breakdown | Notes                                               |
| ---------------------------------------------- | ----- | ----------- | ------------------ | --------------------------------------------------- |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 15/15 | 3.6 s       | ≈ $0.00008         | Specific, correct in every language                 |
| `@cf/meta/llama-3.2-3b-instruct`               | 15/15 | 1.0 s       | ≈ $0.00003         | Nonsense for vague input; a Cyrillic word in Arabic |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast`     | 15/15 | 1.9 s       | ≈ $0.00012         | One- or two-word titles                             |
| `@cf/ibm-granite/granite-4.0-h-micro`          | 5/15  | 4.6 s       | ≈ $0.00001         | Inconsistent reply shape                            |
| Qwen3 30B, Gemma 4 26B, GLM 4.7 Flash          | 0–4/5 | —           | —                  | Reasoning tokens exhausted the output budget        |
| `@cf/meta/llama-3.1-8b-instruct-fp8`           | —     | —           | —                  | Rejects JSON Schema                                 |

## Decision

- Default `AI_MODEL` to `@cf/mistralai/mistral-small-3.1-24b-instruct`. It is
  the cheapest model that was both always valid and consistently useful.
  Changing the variable swaps it; the Zod validation and retries do not depend
  on the model.
- Send every call through AI Gateway with `AI_GATEWAY_ID`, defaulting to
  `default`. Cloudflare creates the `default` gateway on the first
  authenticated request, so installations need no setup step. Each call skips
  the gateway cache and tags its log with `feature: task-breakdown` and the
  task ID.
- Bind `AI` in the production environment only. Local development and the
  browser-test configuration have no AI binding, so breakdown reports itself
  unavailable there; developers can opt in with a remote binding. The Vitest
  pool runs with `remoteBindings: false` and tests inject fakes or mock the
  generation step.
- Limit use per user with a daily quota (`AI_DAILY_LIMIT`, 20) in `ai_usage`
  and a burst limit (`AI_LIMITER`, 5 per 60 seconds).

## Consequences

A breakdown costs about $0.00008, and a user at the default quota costs at
most $0.0016 a day. AI Gateway logs keep the prompt and reply, including task
titles and notes, in the operator's account under the gateway's log
retention. Other Workers in the same account that use the `default` gateway
share its logs and settings; an operator who wants isolation creates a named
gateway and sets `AI_GATEWAY_ID`. Local development cannot exercise the model
without opting in to remote, billed inference. The benchmark is a point-in-time
result; the catalog changes, so re-run it before changing the default.

## Alternatives

- A cheaper model (`llama-3.2-3b-instruct`) passed validation but produced
  visibly worse subtasks; quality matters more than a fraction of a cent.
- A named `tanbase-core` gateway isolates logs but needs a manual or API
  creation step in every installation.
- A local AI binding with `remote: true` for everyone would make `pnpm dev`,
  the browser suite, and CI require Cloudflare credentials and incur cost.
- A fixed fake model in local development would show subtasks that no model
  produced, which misleads more than an unavailable feature.
