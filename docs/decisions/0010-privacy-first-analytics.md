---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# ADR-0010: Optional, privacy-first PostHog analytics

## Context

The launch plan needs product analytics, but TanBase Core is a template whose
forks must never report to this project, and whose auth pages put reset tokens
and redirect targets in URLs. Cookie-based analytics would also require a
consent banner in many jurisdictions. The nonce-based CSP blocks any origin it
does not list.

## Decision

Analytics is off unless the installation sets the `POSTHOG_KEY` Worker secret.
The PostHog project key is public, but storing it as a secret keeps it out of
the repository, so forks inherit no key. `POSTHOG_HOST` is a Wrangler variable
and defaults to PostHog's US ingestion host.

When enabled, the root route passes the key and host to the browser, which
dynamically imports the bundled `posthog-js` SDK with:

- `cookieless_mode: "always"`, so nothing is stored in cookies or browser
  storage;
- page views on history changes and page leaves only, with autocapture,
  session recording, surveys, feature flags, and external script loading
  disabled;
- a `before_send` hook that removes query strings and fragments from every URL
  property, plus PostHog's personal-data masking.

The CSP adds `https://*.posthog.com` (or the configured proxy origin) to
`connect-src` only when a key is configured. `script-src` never changes,
because the SDK is served from the site's own origin.

## Consequences

Visitors download the SDK only on installations that enable analytics.
Cookieless mode requires the PostHog project's "Cookieless server hash mode"
setting, and identified users are not tracked. Richer PostHog features such as
session replay or feature flags need a new decision, because they load remote
scripts and store data in the browser.

## Alternatives

Committing the key as a Wrangler variable would make every fork send events to
this project. Loading PostHog's hosted snippet would add PostHog to
`script-src`. Cookie-based persistence would count unique users across visits
but require consent handling.
