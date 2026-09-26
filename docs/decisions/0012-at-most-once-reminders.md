---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# ADR-0012: At-most-once due-date reminders

## Context

F-012 sends a reminder email when a task is due within a day. An hourly Cron
Trigger enqueues one message per due task, and a queue consumer sends the
email. Queues deliver at least once: a message can arrive twice, and an
overlapping cron run can enqueue the same task again. The feature requires
that a duplicate message never sends a duplicate email. Email Service offers
no idempotency key.

## Decision

The consumer claims a reminder before sending it, with one conditional D1
update that sets `reminder_sent_at` only while it is null, the task is open,
its owner is verified, and its due time still matches the message. Only the
message that wins the claim sends. A delivery that throws releases the claim,
matching on the claim's own timestamp, and retries; after three retries the
message moves to the dead-letter queue. Changing a due date clears
`reminder_sent_at`, so the new date gets its own reminder, while saving an
unchanged date does not.

## Consequences

Duplicates and stale messages are harmless and need no deduplication store.
A Worker that stops between the claim and the send leaves the reminder marked
as sent without an email: that reminder is lost rather than duplicated. A send
that fails after the provider accepted it, such as a timeout, can still be
retried and delivered twice; this is the one remaining duplicate path.

## Alternatives

- Send first, then set `reminder_sent_at`: at least once, so a duplicate
  message arriving before the update sends twice.
- A per-message deduplication table or Durable Object: stronger bookkeeping,
  but the email still cannot be made atomic with the record, and it adds
  storage the task row already provides.
- Workflows: durable steps suit multi-step jobs, but a single send per task
  does not need them.
