---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# 2026-09-25: Production email on send.tanbase.dev

## Summary

Enabled production transactional email. The production `EMAIL` binding is
restricted to `noreply@send.tanbase.dev`, `EMAIL_FROM` names that sender, and
messages use the site name as their display name. The guided installer removes
the binding for accounts that have not onboarded the sender's domain. This PR
also records the F-006 production evidence.

## Motivation

Verification and password-reset emails were only logged, so no one could
complete sign-up in production. The `send.tanbase.dev` sending domain was
onboarded on 2026-09-24, and F-006 now keeps the public auth forms from being
used to send mail to arbitrary recipients.

## Behavior and configuration changes

- The production Wrangler environment adds a `send_email` binding named `EMAIL`
  with `allowed_sender_addresses: ["noreply@send.tanbase.dev"]` and sets
  `EMAIL_FROM` to that address. Local development still has no binding and
  keeps logging safe metadata.
- `sendEmail()` passes a structured sender, `{ email: EMAIL_FROM, name:
siteConfig.name }`, so `EMAIL_FROM` is always a bare address that matches the
  binding's allowed senders.
- The installer reads the configured production sender. If its domain is not
  listed as enabled by `wrangler email sending list`, it removes the production
  binding and clears `EMAIL_FROM`, because the binding cannot deploy on an
  account without Email Sending. The setup summary states which applies.

## Migrations and environment changes

No database migration or secret. Added the production `send_email` binding and
`EMAIL_FROM` value, and regenerated Worker types. `send.tanbase.dev` publishes
its `cf-bounce` MX, SPF, and DKIM records and a `p=reject` DMARC policy, all
managed by Email Service onboarding.

## Validation evidence

Local:

- `pnpm verify` — passed: formatting, lint, 37 maintained documents, Drizzle
  history, types, 43 Workers-runtime tests including the structured-sender
  assertion, one component test, 19 installer tests, import/database
  boundaries, and the production build.
- New installer tests cover removing only the production binding and sender,
  parsing the Wrangler sending table, and rejecting display-name senders.
- Against the account's real `wrangler email sending list` output, the
  installer helper reported `send.tanbase.dev` as enabled and an unknown domain
  as not enabled.
- `pnpm cf:dry-run:production` — passed; 80 Worker modules with
  `env.EMAIL (unrestricted - senders: noreply@send.tanbase.dev)` and
  `EMAIL_FROM ("noreply@send.tanbase.dev")`. Recipients are unrestricted;
  senders are restricted.
- `pnpm cf:typegen` — idempotent.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result                          |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------------------------------- |
| Local      | Working tree based on `3ab15ae` | —                          | 2026-09-25 | Verify, typegen, dry run passed |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed                    |

## Rollback notes

Roll back the Worker version, then revert this change. Emptying `EMAIL_FROM`
alone also stops delivery and restores metadata logging. No data changes are
involved; the sending domain and its DNS records can remain.

## Remaining work

- After deployment, sign up on `core.tanbase.dev` with an operator-controlled
  address and record the message ID, arrival, and SPF, DKIM, and DMARC results.
- Complete the F-005 production journey: verify, sign in, sign out, forgot
  password, and reset.
- Have an operator solve the production Turnstile widget and confirm a sign-in
  reaches the credential check.
