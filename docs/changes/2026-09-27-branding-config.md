---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: Branding in one config

## Summary

A fork now renames the app in one file, `src/lib/site.ts`. Before, the name
was written out 57 times across 27 files. Pages, emails, the preview image,
the web manifest, the MCP server, and the agent documents read the config.
The Tanfust logo and icons in `public/` appear in the header, the preview
image, the favicon, and the manifest. A test keeps the name from being
written anywhere else, and `pnpm run setup` asks for the name and
description. This is F-027.

## Motivation

TanBase Core is a template: a fork's first job is to make it its own. The
agent skill also named `core.tanbase.dev` in its text, so a fork served the
TanBase demo's address to agents, despite
[ADR-0016](../decisions/0016-deploy-without-personalization.md).

## Behavior and configuration changes

- **`siteConfig`** in `src/lib/site.ts` gains `shortName`, `subtitle`, `id`,
  `logo`, `icons`, and `themeColor` beside the name, tagline, description,
  origin, repository, and author, all typed and documented.
- **The header mark** is `BrandMark` in `src/components/brand-lockup.tsx`:
  - a monochrome logo is drawn through a CSS mask in the current text color,
    so the black Tanfust mark shows in both themes
  - any other logo is an `<img>`
  - with no logo, the check-square icon is kept
- **The preview image** bundles the SVGs in `public/` at build time through
  `import.meta.glob`, and tints a monochrome logo white on the blue tile.
- **Icons:** the root head links the favicon, the 96-pixel PNG, and the
  Apple touch icon, and sets `theme-color`. The new `/manifest.webmanifest`
  route serves a web app manifest built from the config.
- **Served templates:** the agent skill and `llms.txt` take `{{name}}`,
  `{{id}}`, `{{repository}}`, `{{origin}}`, and `{{host}}`, which
  `fillTemplate()` fills.
  - Each deployment now serves and digests the skill with its own origin.
  - The skill is named `{{id}}-tasks`, so on TanBase its path moves from
    `/.well-known/agent-skills/tanbase-tasks/SKILL.md` to
    `/.well-known/agent-skills/tanbase-core-tasks/SKILL.md`.
- **From the config:** page descriptions, emails, the Better Auth app name,
  the MCP server name and instructions, the discovery documents, the health
  check's `service`, and browser storage keys.
  - The theme preference key changes from `tanbase-theme` to
    `tanbase-core-theme`, so existing visitors' saved theme resets once.
- **Guard test:** `src/lib/branding.ui.test.ts` fails when "TanBase" appears
  in `src/` outside the config, generated files, tests, and snapshots.
- **`pnpm run setup`** asks for the app's name and description, or takes
  `--app-name` and `--description`, and writes them with the Worker name as
  `id`. It no longer rewrites `llms.txt`, which uses the runtime origin.
- **`pnpm smoke`** reads `siteConfig.id` and checks the manifest link, the
  manifest, and each manifest icon.
- **Cleanup:** removes `src/logo.svg`, the unused logo left from the TanStack
  template.
- **Docs:**
  - README "Make it yours" and DEVELOPMENT "Branding"
  - INSTALLING, DEPLOYMENT, AGENT_DISCOVERY, MODULE_REMOVAL, and AGENTS
  - FEATURES F-027

## Migrations and environment changes

None. The logo and icons are static assets in `public/`.

## Validation evidence

Local:

- `pnpm verify` without `.dev.vars` or `.env`: 201 Worker, 24 UI, 24 setup,
  and 13 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build. New tests cover:
  - the skill naming each deployment's own origin
  - the preview image's logo tint
  - the installer's `site.ts` update and flags
  - the branding guard
- `pnpm cf:dry-run:production` and `pnpm cf:dry-run:default` passed at
  9783.87 KiB.
- `pnpm test:dev-client`: 93 modules. `pnpm test:e2e` with the system Chrome:
  3 passed.
- **Landing JavaScript:** `pnpm perf:bundle` against an `env.local` build
  measured 145.1 KB gzipped, within the 150 KB budget.
- **`vite preview` of the top-level build:**
  - `pnpm smoke -- --url http://localhost:4391 --environment production --config default`
    passed
  - the preview image drew the mark white on the blue tile
  - the header's mask used `/logo.svg` in the primary foreground color at 24
    pixels, in dark mode
  - the sign-in panel showed the mark
  - the page linked the favicon, icon, Apple touch icon, and manifest, with
    no console errors
- **The installer's updater**, run on the real `src/lib/site.ts`, changed
  only the name, short name, description, and `id` values, not the type
  declarations or the author.

Production, 2026-09-27, merge commit `4ccfb71`:

- Workers Build `73cc108f` deployed version `bd9b1421` at 20:17 UTC and passed
  its post-deploy smoke. The pinned smoke passed at 20:22 UTC.
- `/logo.svg`, `/favicon.ico`, `/icon.png`, `/apple-icon.png`, both manifest
  icons, and `/manifest.webmanifest` returned `200` with their media types.
- **Live pages:**
  - the header masks `/logo.svg` at 24 pixels
  - the page links the icons and the manifest and sets `theme-color`
    `#1447e6`, with no console errors
  - the preview image, a cache `HIT`, shows the mark white on the blue tile
- **Agent documents:**
  - the skill is served at
    `/.well-known/agent-skills/tanbase-core-tasks/SKILL.md` and names
    `core.tanbase.dev`
  - the old `tanbase-tasks` path returns `404`
  - `llms.txt` has no unfilled placeholders
- **Production performance run:** 145.2 KB of landing JavaScript, and a
  Lighthouse median of 94 on GitHub's runner.

## Deployment state

| Target     | Commit                                | URL                        | Date       | Result |
| ---------- | ------------------------------------- | -------------------------- | ---------- | ------ |
| Local      | Working tree based on `3c524b9`       | `http://localhost:4391`    | 2026-09-27 | Passed |
| Production | `4ccfb71` / Worker version `bd9b1421` | `https://core.tanbase.dev` | 2026-09-27 | Passed |

## Rollback notes

Revert the change. The pages return to the check-square mark and the old
skill path; the theme preference key changes back, which resets it once more.

## Remaining work

- The colors are still the tokens in `src/styles.css`, apart from
  `themeColor`.
- The landing page copy in `homepage.ts` and the summary in `llms.txt`
  describe TanBase; a fork rewrites them.
