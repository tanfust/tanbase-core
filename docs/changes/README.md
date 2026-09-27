---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-25
---

# Change records

Create one record for each meaningful implementation PR from
[the template](TEMPLATE.md). Record actual commands and evidence, keeping local
and production states separate.

Records:

- [2026-09-16: Cloudflare foundation](2026-09-16-cloudflare-foundation.md)
- [2026-09-16: Cloudflare-owned deployments](2026-09-16-cloudflare-owned-deployments.md)
- [2026-09-17: Align pnpm with Cloudflare Workers Builds](2026-09-17-pnpm-cloudflare-build-alignment.md)
- [2026-09-17: Authentic agent discovery baseline](2026-09-17-agent-discovery-baseline.md)
- [2026-09-17: Markdown negotiation readiness](2026-09-17-markdown-negotiation-readiness.md)
- [2026-09-18: D1 and Drizzle foundation](2026-09-18-d1-drizzle-foundation.md)
- [2026-09-18: Production-only default deployment](2026-09-18-production-only-default.md)
- [2026-09-19: Cloudflare transactional email foundation](2026-09-19-cloudflare-email-foundation.md)
- [2026-09-19: Better Auth D1 core](2026-09-19-better-auth-d1-core.md)
- [2026-09-19: Resumable guided setup](2026-09-19-guided-setup.md)
- [2026-09-20: Authentication and task-board UI](2026-09-20-authentication-task-board-ui.md)
- [2026-09-24: Canonical origin on core.tanbase.dev](2026-09-24-canonical-tanbase-dev.md)
- [2026-09-24: Turnstile and rate limits on auth](2026-09-24-auth-turnstile-rate-limits.md)
- [2026-09-25: Production email on send.tanbase.dev](2026-09-25-production-email.md)
- [2026-09-25: Security headers, error pages, and request logging](2026-09-25-security-headers.md)
- [2026-09-25: Cached health check and privacy-first analytics](2026-09-25-health-cache-analytics.md)
- [2026-09-25: Restore dev-server hydration](2026-09-25-dev-hydration-fix.md)
- [2026-09-25: Task attachments on R2](2026-09-25-r2-attachments.md)
- [2026-09-25: Live board on Durable Objects](2026-09-25-live-board.md)
- [2026-09-25: Post-deploy smoke waits for the deployed version](2026-09-25-deploy-smoke-version.md)
- [2026-09-25: Place the production Worker next to D1](2026-09-25-placement-near-d1.md)
- [2026-09-26: Due-date reminders on Cron Triggers and Queues](2026-09-26-due-date-reminders.md)
- [2026-09-26: AI task breakdown on Workers AI, AI Gateway, and Workflows](2026-09-26-ai-task-breakdown.md)
- [2026-09-26: Reload once when a fresh deployment's assets are missing](2026-09-26-asset-recovery.md)
- [2026-09-26: MCP server with OAuth 2.1 through Better Auth](2026-09-26-mcp-server.md)
- [2026-09-26: Verify MCP access tokens with in-process keys](2026-09-26-mcp-in-process-jwks.md)
- [2026-09-26: Agent discovery for the MCP server](2026-09-26-agent-discovery.md)
- [2026-09-26: Serve the AI Catalog with its own media type](2026-09-26-ai-catalog-media-type.md)
- [2026-09-26: PostHog Error Tracking with bundled capture and source maps](2026-09-26-posthog-error-tracking.md)
- [2026-09-26: Core Web Vitals in PostHog and a superseded-build deploy guard](2026-09-26-web-vitals-and-deploy-guard.md)
- [2026-09-26: Landing page and SEO layer](2026-09-26-landing-page-and-seo.md)
- [2026-09-27: Narrow the roadmap to the launch path](2026-09-27-roadmap-scope.md)
- [2026-09-27: Agent layer: module map, rules, and task skills](2026-09-27-agent-layer.md)
- [2026-09-27: Module removal, proven for every optional module](2026-09-27-module-removal.md)
- [2026-09-27: A deployment works without personalization](2026-09-27-deploy-without-personalization.md)
- [2026-09-27: A Deploy to Cloudflare button and a generic top level](2026-09-27-deploy-button.md)
- [2026-09-27: Preview images drawn on the Worker](2026-09-27-preview-images.md)
- [2026-09-27: Performance budgets measured and checked](2026-09-27-performance-budgets.md)

Once merged, a change record is historical and immutable except for factual
corrections or the explicitly planned post-deployment evidence update. Current
truth belongs in code, active guides, and [status](../STATUS.md).
