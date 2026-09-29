---
name: finish-setup
description: In a deployed copy of TanBase Core, check what the first deploy left off and help its owner set up, leave off, or remove each optional setting, such as a custom domain, email, reminders, Turnstile, analytics, attachments, placement, and AI. Use when the owner asks what is left to set up, to finish the setup, to add a domain or email, why sign-in fails after setting BETTER_AUTH_URL, or after a first deploy from the Deploy to Cloudflare button or a dashboard import.
---

# Finish the setup of a deployed copy

A first deploy from the Deploy to Cloudflare button, or from a repository
imported in the dashboard, runs with every optional setting off
([ADR-0022](../../../docs/decisions/0022-setup-page-asks-nothing-that-can-break.md)).
`docs/DEPLOYMENT.md#finishing-the-setup` lists each setting and where to set
it. This skill finds which are off in the owner's Worker and works through
them with the owner, one at a time.

The owner decides each setting. Ask before every push, since a push to the
production branch deploys, and before removing a module.

## 1. Check the checkout and the login

- `git remote get-url origin` should be the owner's repository. In the
  upstream `tanfust/tanbase-core` checkout, only report; change nothing.
- `pnpm install` if `node_modules` is missing.
- `pnpm exec wrangler whoami`. When it is not logged in, ask the owner to
  run `pnpm exec wrangler login` themselves; it opens their browser.

## 2. Read what the Worker serves

```sh
pnpm run setup:status
```

It reads the version the Worker serves, changes nothing, and prints each
setting as `ok`, `on`, `off`, or `attention`, with the next step and the
guide section. It defaults to the Worker named in `wrangler.jsonc`. A copy
deployed from the button is named after the project name on its setup page;
when the status says there is no such Worker, ask the owner for that name,
shown in the dashboard under **Workers & Pages**, and pass it:

```sh
pnpm run setup:status -- --name <worker>
```

Show the owner the whole report before changing anything.

## 3. Fix what needs attention first

An `attention` line is a setting that is half done, and some stop sign-in:
a Turnstile site key without its secret, a missing `BETTER_AUTH_SECRET`, or a
`BETTER_AUTH_URL` that does not serve this Worker yet. Fix those before
turning anything on, with the step the report names.

## 4. Ask about each setting that is off

For each `off` line, ask the owner whether to set it up now, leave it off,
or remove its module. Leaving a setting off is always safe; nothing needs
it to use the site.

| Setting            | To set it up                                                                                 | To remove it                                      |
| ------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Custom domain      | The owner adds it under **Settings → Domains & Routes**; then set `BETTER_AUTH_URL`          | —                                                 |
| Email              | `docs/DEPLOYMENT.md#transactional-email`: a sender domain, the `EMAIL` binding, `EMAIL_FROM` | —                                                 |
| Due-date reminders | Email and `BETTER_AUTH_URL`; the queue comes with `pnpm run deploy`                          | The `jobs` module, with the `remove-module` skill |
| Bot checks         | `docs/DEPLOYMENT.md#turnstile-and-auth-rate-limits`                                          | —                                                 |
| Analytics          | `docs/DEPLOYMENT.md#analytics`                                                               | —                                                 |
| Attachments        | The owner enables **R2 Object Storage**; then redeploy                                       | The `files` module, with `remove-module`          |
| Placement          | `pnpm run placement --write`, then commit and push                                           | —                                                 |
| AI task breakdown  | On by default and billed to the account; `AI_DAILY_LIMIT` `0` turns it off                   | The `ai` module, with `remove-module`             |

Read the linked section before starting a setting; it has the details this
table leaves out.

## 5. Make the change

- **Variables** go in `vars` at the top level of `wrangler.jsonc`, which is
  what a button or dashboard copy deploys. Never add one with an empty value.
  The owner can instead set them under the Worker's **Settings → Variables
  and Secrets**; later deploys keep those, since the top level sets
  `keep_vars`.
- **Secrets**, such as `TURNSTILE_SECRET_KEY` and `POSTHOG_KEY`, never go in
  `wrangler.jsonc`, the repository, or the chat. Give the owner the command
  to run themselves, and let them type the value at its prompt:

  ```sh
  pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --name <worker>
  ```

  Or they add it as a **Secret** under **Settings → Variables and Secrets**.

- **Leave `env.production` alone** while it still names
  `core.tanbase.dev`: it is the TanBase demo's configuration, and the copy
  does not deploy it.
- **Deploying:** with the owner's go-ahead, commit and push to the branch
  Workers Builds deploys, usually `main`. Do not deploy from this machine
  unless the owner asks. A setting made only in the dashboard needs no push.
- **Order for a custom domain:** the domain first, then `BETTER_AUTH_URL`.
  While `BETTER_AUTH_URL` names an address that does not serve the Worker
  yet, sign-in works only there, and the sign-in pages say so.

## 6. Check it

After the Workers Build finishes, or after a dashboard change, run
`pnpm run setup:status` again and show the owner the line that changed. When
a setting needs a check in the browser, such as a verification email
arriving or the Turnstile widget showing on `/sign-up`, ask the owner to try
it.

Stop when every line is `ok`, `on`, or an `off` the owner chose to keep.
