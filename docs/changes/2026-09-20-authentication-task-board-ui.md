---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-20
---

# 2026-09-20: Authentication and task-board UI

## Summary

Added the complete local authentication experience, responsive protected shell,
D1-backed project/task board, account settings, theme persistence, and isolated
browser coverage. The UI follows the existing Base UI Luma system and retains
Better Auth and ownership-scoped D1 as the application boundaries.

## Motivation

The repository had verified server-side auth and task storage but no usable
product journey. This slice makes those foundations operable without importing
the Supabase, billing, organization, or placeholder SaaS behavior from the
visual reference application.

## Behavior and configuration changes

- Added the product landing page and email/password sign-up, sign-in,
  verification resend, forgot-password, and token-aware reset pages.
- Preserved only safe same-origin return paths and send sign-out back to login.
- Added a responsive Base UI sidebar, project switcher, breadcrumbs, account
  menu, and persisted light, dark, or system appearance without a theme flash.
- Added request-scoped TanStack Query integration and authenticated server
  functions for project/task snapshots and mutations.
- Added project create, rename, switch, and confirmed delete plus task create,
  edit, delete, due date, notes, and explicit status movement.
- Added optimistic task mutations with rollback and refetch, protected by
  TanStack Start's server-function CSRF middleware.
- Added profile-name and password settings; account email remains read-only.

## Migrations and environment changes

No database migration, Cloudflare binding, Worker variable, secret, or generated
Worker type changed. Added direct `@tanstack/react-query` and `zod` dependencies,
the Playwright development dependency, and an isolated local-only
`wrangler.e2e.jsonc` configuration on port `3110`.

## Validation evidence

- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/Users/wassim/.codeium/windsurf/ws-browser/chromium_headless_shell-1169/chrome-mac/headless_shell pnpm test:e2e`
  — two isolated local D1 browser journeys passed, including auth, reset, CRUD,
  settings, refresh persistence, sign-out, 375/768/1440 px layouts, mobile
  sidebar behavior, and invalid-token recovery.
- `pnpm verify` — formatting, lint, documentation, migration history, types, 37
  Workers-runtime tests, one component test, 15 installer tests, import/database
  boundaries, and the production build passed.
- `pnpm cf:dry-run:production` — production build and Wrangler packaging passed;
  74 Worker modules were packaged with the existing production D1 and variables.

## Deployment state

| Target     | Commit                          | URL                                | Date       | Result                                      |
| ---------- | ------------------------------- | ---------------------------------- | ---------- | ------------------------------------------- |
| Local      | Working tree based on `09da4c1` | `http://localhost:3110`            | 2026-09-20 | Browser journey, verify, and dry run passed |
| Production | —                               | `https://tanbase-core.tanfust.com` | 2026-09-20 | Not deployed or browser-verified            |

## Rollback notes

Revert the UI, query, server-function, and repository changes together. Existing
D1 auth, project, and task tables remain compatible and require no rollback.

## Remaining work

- Prove verification and reset delivery against the production sender and URL.
- Add Turnstile and distributed auth rate limiting in F-006.
- Add Google and magic-link sign-in in F-009.
- Add persisted drag and keyboard ordering in F-008.
- Deploy, run production browser smoke, and update the status evidence; local
  success does not imply deployment.
