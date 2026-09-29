---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-29
---

# ADR-0022: The Deploy button's setup page asks for nothing that can break

## Context

The Deploy to Cloudflare button builds its setup page from the top level of
`wrangler.jsonc`: a field for every variable and for every resource it will
create, such as a queue's name. On 2026-09-29 a run showed three problems:

- **The page refuses an empty field.** The top level set `BETTER_AUTH_URL`,
  `EMAIL_FROM`, `TURNSTILE_SITE_KEY`, and `POSTHOG_HOST` to `""`, meaning
  "off", and their descriptions said to leave them empty. The page would not
  continue until they were filled.
- **A filled field breaks the first deploy.**
  - The tester typed `klapt.ai` into `BETTER_AUTH_URL`. With that value the
    Worker throws `BETTER_AUTH_URL must be an absolute URL`, so every page
    that needs the origin fails, sign-in included.
  - `https://klapt.ai` would also have broken sign-in on the `workers.dev`
    address, since Better Auth trusts only its own origin.
  - A Turnstile site key without its secret stops sign-in, and any
    `APP_ENV` other than `production` runs the site as local development.
- **The queue field carried the template's name,** `tanbase-core-email`.
  Renaming it there may not rename the consumer or the dead-letter queue,
  which name it separately; Cloudflare does not document it.

[ADR-0021](0021-deploy-binds-r2-and-creates-the-auth-secret.md) had already
taken the R2 bucket and the secret off the page.

## Decision

- **The top level sets only variables whose default works.** Those are the
  three `AI_*` variables, whose setup-page descriptions explain the cost.
  `APP_ENV`, `BETTER_AUTH_URL`, `EMAIL_FROM`, `TURNSTILE_SITE_KEY`, and
  `POSTHOG_HOST` are gone from it:
  - A Worker without `APP_ENV` runs as production, through
    `appEnvironment()` in `src/platform/environment.ts`.
  - Each of the others was already off when unset.
  - `env.local` and `env.production` keep setting all of them.
- **Deploys keep dashboard variables.** The top level sets `keep_vars`, so a
  variable set later under **Settings → Variables and Secrets** survives the
  next push. `keep_vars` applies to the whole file, `env.production`
  included, where every variable is set in the file.
- **`pnpm run deploy` binds the reminder queue.** The top level declares no
  queue. Each deploy writes `<worker>-email` as `EMAIL_QUEUE`, with this
  Worker as its consumer and `<worker>-email-dlq`, into the generated
  configuration, as it does for R2, and Wrangler creates the queues. A copy
  that still declares the queue keeps its name.
- **`BETTER_AUTH_URL` cannot fail every page:**
  - A bare host means `https://`.
  - A value that is still not an http or https URL is ignored and logged.
  - While it names another origin than the page's, the sign-in pages say
    where sign-in works.
- **What the page no longer asks is documented.** DEPLOYMENT's "Finishing
  the setup" lists each optional setting and where to set it, so the owner,
  or a coding agent working in their copy, can turn each on later.

## Consequences

- The setup page asks for the repository and project name, the D1
  database, and three pre-filled AI variables. None needs changing.
- A mistyped origin now degrades to the request's origin instead of failing
  loudly. The warning `origin.invalid_setting` is the only signal besides
  the sign-in notice.
- The generated `Env` marks `EMAIL_QUEUE` and the five variables optional.
  The code already read them as optional.
- A copy made before this change that merges it, without its own top-level
  queue, moves reminders to `<worker>-email`. Messages still waiting in the
  old queue are not consumed; reminders are hourly, so the loss is at most
  one run's.
- In `env.production`, a variable removed from the file now stays on the
  Worker until it is removed in the dashboard too.

## Alternatives

- **Keep the variables and explain them better.** The page still refuses
  empty fields.
- **Placeholder values such as `off`.** Every reader of each variable would
  need to understand a sentinel, and the page would still invite editing.
- **Keep the queue on the page.** Its rename is undocumented, and the
  template's name would stay in every copy.
- **Move the D1 database off the page too.** Its name chooses which database
  a copy's data lives in, and the page offers its location; renaming it later
  would lose data.
