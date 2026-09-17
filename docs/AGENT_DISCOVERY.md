---
status: active
audience: users, maintainers, operators, agents
last_verified: 2026-09-17
---

# Agent discovery

TanBase Core publishes a small discovery surface that describes only current,
public capabilities. The canonical production origin is
`https://tanbase-core.tanfust.com`. The hostname, certificate, HTTP redirect,
and HTML discovery baseline were activated and smoke-tested on 2026-09-17;
Markdown negotiation remains a separate gated capability.

## Published resources

| Resource       | Contract                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| `/sitemap.xml` | XML sitemap containing only the canonical public homepage                |
| `/robots.txt`  | Production crawl policy, Content Signals, and canonical sitemap location |
| `/llms.txt`    | Public product summary, documentation links, and capability boundaries   |
| `/`            | Canonical and Open Graph URL plus HTTP discovery and Content Signals     |

Production `robots.txt` allows crawling. Local and preview environments use
`Disallow: /` and do not advertise the production sitemap. All discovery
documents use `Cache-Control: public, max-age=300`.

Cloudflare may prepend zone-managed `robots.txt` groups for named AI training
crawlers. Production validation therefore checks the application's exact
`User-agent: *` group rather than rejecting every bot-specific `Disallow:`
directive. The application group still allows general crawling and advertises
the canonical sitemap.

The homepage advertises these truthful HTTP links:

```http
Link: <https://tanbase-core.tanfust.com/llms.txt>; rel="describedby"; type="text/markdown"
Link: <https://tanbase-core.tanfust.com/sitemap.xml>; rel="related"; type="application/xml"
```

Both relation tokens are registered by IANA. Sitemap location is also published
through the protocol-standard `Sitemap:` directive in production `robots.txt`;
`sitemap` is not used as a link-relation token because it is not registered.

The origin policy is:

```http
Content-Signal: ai-train=no, search=yes, ai-input=yes
```

The same directive appears in `robots.txt`; the response header also appears on
the homepage and `llms.txt`. The policy allows search indexing and agent-time AI
input while reserving the content from model training. Content Signals express
a preference and do not technically prevent access.

## Markdown negotiation

Markdown for Agents is a Cloudflare zone-edge capability, not an application
route or Worker binding. Once enabled for `tanbase-core.tanfust.com`, a request
to `/` with `Accept: text/markdown` must return the converted page with:

- `Content-Type: text/markdown; charset=utf-8`
- `Vary` containing `Accept`
- A positive `x-markdown-tokens` value
- The origin `Content-Signal: ai-train=no, search=yes, ai-input=yes` policy

Requests without the Markdown accept header must continue to receive the HTML
document. The feature is not complete until the canonical production URL passes
the live smoke command with `--expect-markdown`; local Worker previews do not
simulate Cloudflare's zone-level conversion.

The `tanfust.com` zone was confirmed on the Free plan on 2026-09-17. Its
Cloudflare dashboard marks Markdown for Agents as disabled and Pro-only, and a
live `Accept: text/markdown` request currently returns HTTP 500. Do not claim
Markdown negotiation until the zone is upgraded, the edge feature is enabled,
and the opt-in smoke gate passes.

## Capability gates

Do not publish empty, speculative, or scanner-only metadata. Add each resource
only when the named capability exists and can be verified:

- Publish an API catalog and `service-doc` relation only with a supported public
  API and stable OpenAPI or service documentation.
- Publish OAuth/OIDC authorization-server metadata only if TanBase operates the
  corresponding authorization server. Login through a third-party provider is
  not sufficient.
- Publish protected-resource metadata and `auth.md` only with a real protected
  agent resource, registration flow, credential issuance, claims, and
  revocation behavior.
- Publish an MCP server card only after F-015 exposes an accessible MCP
  transport and the card schema is revalidated against the current standard.
- Publish a skill index only for curated external product skills. Repository
  operating instructions under `.agents/` or `.claude/` are not public product
  capabilities.
- Add WebMCP only when stable, agent-safe browser actions exist.
- Add an ARD manifest only when it can enumerate real MCP, A2A, OpenAPI, or
  equivalent public resources.
- Add DNS-AID only after the draft is revalidated and the public discovery zone
  is deliberately operated with DNSSEC validation.

## Production activation

`tanbase-core.tanfust.com` is attached to the production `tanbase-core` Worker.
Cloudflare terminates TLS and redirects the HTTP root to the exact HTTPS URL.
Verify the active HTML discovery baseline with:

```sh
pnpm smoke -- --url https://tanbase-core.tanfust.com --environment production
```

After the zone supports the feature, enable **Markdown for Agents** in **AI
Crawl Control** or through a Configuration Rule scoped to
`tanbase-core.tanfust.com`, then run the additional negotiation gate:

```sh
pnpm smoke -- --url https://tanbase-core.tanfust.com --environment production --expect-markdown
```

Record the deployed commit, URL, UTC date, and smoke result in
[status](STATUS.md). A local build or Wrangler dry run is not deployment
evidence.

## References

- [Sitemaps XML protocol](https://www.sitemaps.org/protocol.html)
- [Web Linking, RFC 8288](https://www.rfc-editor.org/rfc/rfc8288)
- [IANA Link Relation Types](https://www.iana.org/assignments/link-relations/link-relations.xhtml)
- [Content Signals](https://contentsignals.org/)
- [Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)
- [TanStack Start server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
