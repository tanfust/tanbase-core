---
status: active
audience: testers, maintainers
last_verified: 2026-09-29
---

# Fresh-account install test

F-023 is done when someone outside Tanfust, on a Cloudflare account they have
never used for Workers, reaches a working deploy in under 15 minutes using
only the README. This is the script to hand them and what to send back.

## Before you start

You need:

- A new Cloudflare account, or one that has never deployed a Worker. Sign up
  at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) if needed;
  account creation is not timed.
- A payment method. The README asks for Workers Paid, $5 a month; upgrading
  is part of the timed test.
- A GitHub or GitLab account.
- A browser. A terminal is optional.

Do not read anything but the
[README](https://github.com/tanfust/tanbase-core#readme) during the test,
and do not ask anyone for help. Where the README is unclear, note it, make
your best guess, and keep going.

## The test

Start a timer when you open the README. Write down the time at each step.

| Step | Do this                                                                             | Time |
| ---- | ----------------------------------------------------------------------------------- | ---- |
| 1    | Open the README and find how to deploy                                              |      |
| 2    | Do whatever the README says is needed first, such as Workers Paid                   |      |
| 3    | Click **Deploy to Cloudflare** and finish the setup page                            |      |
| 4    | Wait for the first deploy to finish                                                 |      |
| 5    | Open the deployed `workers.dev` URL; the landing page loads                         |      |
| 6    | Create an account; you land on your board                                           |      |
| 7    | Create a task, move it to Doing, and attach a small image if the task allows it     |      |
| 8    | Open the board in a second tab, change the task there, and see the first tab update |      |

Stop the timer at step 8. The test passes when step 8 is done in under 15
minutes. R2 is optional: without it, the task says attachments are off, and
step 7 passes without the image.

## Send back

1. Your time for each step, and the total.
2. Every place you hesitated, guessed, or hit an error, with the step number
   and what the screen said. Screenshots help.
3. The deployed URL.
4. What the setup page asked you for, which resources it said it would
   create, whether you changed any field, and whether you left **Protect
   with Cloudflare Access** ticked.
   If the deployed URL asked you to sign in to Cloudflare, say so.
5. Whether you had to add a payment method at any point, and for what.
6. Whether you used the **Deploy to Cloudflare** button or imported the
   repository from the dashboard, and the Workers Build log if a build
   failed.
7. The `Attachments:`, `BETTER_AUTH_SECRET:`, and `Reminders:` lines at
   the end of the first build's log, and whether your account had R2
   enabled.

## For the maintainer

After a run, record the result in the F-023 section of
[FEATURES](FEATURES.md) and fix what the tester hit. From the tester's
account, or the tester's report, confirm what the button and the first
deploy created: the D1 database, the `<worker>-email` queue and its
dead-letter queue, the Durable Object namespace, and the Workflow, and the R2
bucket when the account had R2. Then compare it with the table in
[Deploying](DEPLOYMENT.md#deploy-to-cloudflare-button).
