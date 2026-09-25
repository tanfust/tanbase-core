---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# 2026-09-25: Task attachments on R2

## Summary

Added F-010 task attachments. Files upload from the task dialog, stream through
the Worker into the `FILES` R2 bucket, and download only for their owner. D1
records them with ownership-enforcing constraints. Deleting an attachment,
task, or project removes its objects. The health endpoint reports R2 status,
and the guided installer provisions the bucket or turns attachments off when R2
is unavailable.

## Motivation

Attachments are the first Cloudflare primitive after D1 on the launch path
and the product feature that justifies the R2 binding.

## Behavior and configuration changes

- Migration `0002` adds `attachment` with `project_id`, a composite foreign key
  to `task(id, project_id, user_id)` that cascades deletes, a unique object key,
  a 1 byte to 10 MB size check, and owner indexes.
- `POST /api/tasks/:taskId/attachments` streams a raw request body into R2 under
  `u/{userId}/t/{taskId}/{attachmentId}`. It requires a same-origin `Origin`, a
  session, a `Content-Length` of at most 10 MB, an allowlisted type, a
  URL-encoded `X-Attachment-Name`, an owned task, and fewer than 20 existing
  attachments. Rejected requests store nothing; a failed record insert deletes
  the object.
- `GET /api/attachments/:attachmentId` streams the owner's object with
  `Content-Disposition: attachment`, a sandboxed CSP, and `private, no-store`;
  other users receive `404`.
- Server functions list a task's attachments, report whether files are
  enabled, and delete an attachment and its object. Task and project deletion
  collect object keys, including subtasks', before the cascading delete and
  remove the objects afterwards, logging `attachment.cleanup_failed` on error.
- The task dialog shows attachments for existing tasks with upload, download,
  delete, limit messages, and an "attachments are off" state.
- `GET /api/health` adds `checks.files` (`ok`, `error`, or `disabled`), cached
  like the database check. The smoke suite expects `ok` when the target's
  Wrangler environment binds `FILES`.
- The installer creates or reuses `<worker-name>-files`, personalizes the local
  bucket name, and removes the production binding when Wrangler reports that R2
  is not enabled.
- The browser suite uploads, downloads, and deletes an attachment, and now
  waits for hydration after reloading the settings page, fixing a race that
  could submit the password form before React attached its handler.

## Migrations and environment changes

Migration `0002_wise_omega_flight.sql` is additive and applies before the code
deploys. Added the `FILES` R2 binding to the local, production, and
browser-test configurations and regenerated Worker types. Production requires
R2 enabled for the account and the `tanbase-core-files` bucket to exist before
deployment.

## Validation evidence

Local:

- `pnpm verify` — passed: formatting, lint, 43 maintained documents, Drizzle
  history, types, 65 Workers-runtime tests, one component test, 21 installer
  tests, import/database boundaries, and the production build.
- New runtime tests, against Wrangler's local R2 and migrated D1, cover the
  object key and contents, eight rejected upload cases that store nothing, the
  20-attachment cap, sandboxed owner downloads, `404` for other users, `401`
  without a session, cleanup that leaves no objects after deleting a task with
  a subtask or a project, owner-scoped key listing, filename sanitizing, and
  `Content-Disposition` encoding. Health tests cover the `files` check, its
  `disabled` state, sanitized failures, and caching.
- `pnpm test:e2e` — passed twice in a row, including uploading, downloading,
  and deleting an attachment and deleting a task that still had one.
- `pnpm test:dev-client` — 72 client modules loaded.
- `pnpm cf:dry-run:production` — passed; 88 Worker modules with
  `env.FILES (tanbase-core-files)`.
- `wrangler r2 bucket list` in the production account first failed with code
  10042 because R2 was not enabled. The operator enabled R2 and created
  `tanbase-core-files` on 2026-09-25 at 21:14 UTC; `wrangler r2 bucket info`
  reports it in location WEUR with no objects.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result                                    |
| ---------- | ------------------------------- | -------------------------- | ---------- | ----------------------------------------- |
| Local      | Working tree based on `bc8bfa2` | `http://localhost:3110`    | 2026-09-25 | Verify, browser suite, and dry run passed |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed; bucket created              |

## Rollback notes

Roll back the Worker version, then revert this change. The `attachment` table
and bucket can remain unused. Deleting stored objects is a separate, deliberate
operation and must not be part of a code rollback.

## Remaining work

- Deploy and verify the attachment journey on `core.tanbase.dev`.
- Per-user storage quotas and upload rate limits belong to F-022.
- A scheduled sweep for objects whose cleanup failed can run with F-012 cron.
