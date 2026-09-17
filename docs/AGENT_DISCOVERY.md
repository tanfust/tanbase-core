---
status: active
audience: users, maintainers, operators, agents
last_verified: 2026-09-17
---

# Agent discovery

TanBase Core publishes a small discovery surface that describes only current,
public capabilities. The canonical production origin is
`https://tanbase-core.tanfust.com`. Production remains unverified until that
origin resolves, serves a valid certificate, and passes the repository smoke
command.

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

## Capability gates

Do not publish empty, speculative, or scanner-only metadata. Add each resource
only when the named capability exists and can be verified:

- Enable Markdown content negotiation only after the Cloudflare zone supports
  and enables Markdown for Agents. HTML remains the origin default.
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

In Cloudflare, attach `tanbase-core.tanfust.com` as a custom domain for the
`tanbase-core` Worker. Add a hostname-scoped redirect from HTTP to the same HTTPS
host while preserving the path and query string. Then verify DNS, TLS, the HTTP
redirect, discovery resources, and application behavior with:

```sh
pnpm smoke -- --url https://tanbase-core.tanfust.com --environment production
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
