---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-19
---

# 2026-09-19: Cloudflare transactional email foundation

## Summary

Added the server-only transactional email module used by later authentication
and reminder features: typed React Email templates, runtime HTML and plain-text
rendering, native Cloudflare Email Service delivery, and a safe no-sender
logging fallback.

## Motivation

Authentication needs verification and password-reset delivery before its UI can
represent real production behavior. Cloudflare's native Worker binding keeps
delivery in the existing platform and removes the external API key and SDK.

## Behavior and configuration changes

- `sendEmail({ to, subject, template, props })` accepts only props valid for the
  selected template.
- Added verify-email, reset-password, magic-link, and task-reminder templates.
- The Worker `EMAIL` binding sends structured HTML and plain-text messages when
  `EMAIL_FROM` is configured.
- Without `EMAIL_FROM`, delivery logs only the template and recipient count. It
  never logs recipients, links, message bodies, tokens, or credentials.
- Provider errors are converted to a stable error without exposing Cloudflare
  response details.

## Migrations and environment changes

No database migration was added. Added pinned `react-email@6.9.5`, configured
the non-remote `EMAIL` binding for local development and production, and removed
the Resend SDK. `EMAIL_FROM` remains empty until the sender domain is onboarded.

## Validation evidence

- `pnpm cf:typegen` — generated `EMAIL: SendEmail` for local and production.
- `pnpm verify` — formatting, lint, docs, Drizzle history, types, 27
  Workers-runtime tests, boundary checks, and production build passed.
- The email suite covers safe metadata logging, mock binding delivery,
  sanitized binding failure, and Wrangler's real local binding simulation.
- `pnpm cf:dry-run:production` — passed and reported `env.EMAIL` as an
  unrestricted Send Email binding alongside production D1.
- `pnpm smoke -- --url http://localhost:3005 --environment local` — passed the
  database-aware health, SSR, and discovery checks.
- `pnpm exec wrangler email sending list` — blocked by Cloudflare code 2036.
  The dashboard confirmed Email Sending is unavailable until Workers Paid.

## Deployment state

| Target     | Commit                          | URL                                | Date       | Result                                          |
| ---------- | ------------------------------- | ---------------------------------- | ---------- | ----------------------------------------------- |
| Local      | Working tree based on `a031fdf` | `http://localhost:3005`            | 2026-09-19 | Verify, dry run, binding test, and smoke passed |
| Production | —                               | `https://tanbase-core.tanfust.com` | 2026-09-19 | Email binding not deployed or tested            |

## Rollback notes

Remove `src/modules/email`, `react-email`, both `send_email` bindings, the
`EMAIL_FROM` variables, and the active documentation changes. No database state
requires rollback.

## Remaining work

- Upgrade the account to Workers Paid, confirm Email Sending access, then
  onboard the production sender domain and configure `EMAIL_FROM`.
- Send one controlled production delivery and record the message ID and result.
- Connect Better Auth verification and reset hooks to `sendEmail()` in F-005.
