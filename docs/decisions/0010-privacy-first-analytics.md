---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
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

## Amendment (2026-09-26)

Exception capture is now on. `capture_exceptions: true` records uncaught errors
and unhandled rejections as `$exception` events for PostHog Error Tracking.
The SDK normally fetches that code from PostHog's CDN, which
`disable_external_dependency_loading` and the CSP both block, so the page
bundles `posthog-js/dist/exception-autocapture` and loads it before `init`.
`script-src` still never changes.

Error messages and stack frames can quote a URL, such as a reset link, so the
`before_send` hook also strips query strings and fragments from every absolute
or root-relative URL in `$exception_list` messages and frame filenames.
Messages are otherwise sent as written.

Readable stack traces need source maps. The deploying Workers Build uploads the
browser bundle's maps with a personal API key held only in Workers Builds, and
deletes them before deployment, so they are never served. The rest of this
decision stands.

## Amendment (2026-09-26): web vitals

Core Web Vitals are on: `capture_performance` enables web vitals with
`web_vitals_attribution: false`, so `$web_vitals` events carry LCP, INP, CLS,
and FCP values without the element selectors and resource URLs that
attribution adds, and `network_timing: false`. The page bundles
`posthog-js/dist/web-vitals`, as it does the exception extension. Each metric
repeats the page URL in `$current_url` and `navigationURL`; `before_send`
strips their query strings and fragments too. Session replay stays off.
