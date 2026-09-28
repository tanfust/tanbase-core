---
status: active
audience: users, maintainers, operators, agents
last_verified: 2026-09-28
---

# Agent discovery

TanBase Core publishes a discovery surface that describes only current,
public capabilities: the site, its MCP server, the MCP server's OAuth
authorization server, the health endpoint, and one curated product skill. The
canonical production origin is `https://core.tanbase.dev`
([ADR-0008](decisions/0008-canonical-production-domain.md)). The Worker serves
every document itself
([ADR-0015](decisions/0015-worker-served-agent-discovery.md)).

## Published resources

| Resource                                                | Contract                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/sitemap.xml`                                          | XML sitemap of the canonical homepage, the blog, and its posts           |
| `/blog/rss.xml`                                         | RSS 2.0 feed of the blog's posts                                         |
| `/robots.txt`                                           | Production crawl policy, Content Signals, and canonical sitemap location |
| `/llms.txt`                                             | llmstxt.org summary with linked docs, agent entry points, and limits     |
| `/`                                                     | HTML by default, Markdown on request, discovery links, Content Signals   |
| `/.well-known/api-catalog`                              | RFC 9727 API catalog listing `/mcp`                                      |
| `/.well-known/ai-catalog.json`                          | AI Catalog of the MCP server card, the skill, and the API catalog        |
| `/.well-known/ard.json`                                 | The same catalog under its ARD v0.91 name                                |
| `/mcp/server-card`                                      | MCP Server Card (SEP-2127)                                               |
| `/.well-known/mcp/server-card.json`                     | The same card with the fields of the earlier SEP-1649 draft              |
| `/.well-known/agent-skills/index.json`                  | Agent Skills Discovery index, v0.2.0                                     |
| `/.well-known/agent-skills/tanbase-core-tasks/SKILL.md` | The skill: connecting to `/mcp` and using the task tools                 |
| `/.well-known/oauth-protected-resource/mcp`             | RFC 9728 protected resource metadata for `/mcp`                          |
| `/.well-known/oauth-authorization-server/api/auth`      | RFC 8414 authorization server metadata for Better Auth                   |

`src/modules/discovery/` builds the catalog, card, and skill documents. The
card's server info and tools come from the definitions `/mcp` registers, and
URLs and identifiers derive from `BETTER_AUTH_URL`, so a local run describes
its own origin. The skill's digest is computed from the bytes served. The AI
Catalog is served as `application/ai-catalog+json`, which is not yet
IANA-registered. The discovery documents answer `GET`, `HEAD`, and CORS
preflights from any origin, send an `ETag`, and use
`Cache-Control: public, max-age=300`. The
root and path-inserted OAuth documents come from Better Auth
([ADR-0014](decisions/0014-mcp-oauth-with-better-auth.md)).

Production `robots.txt` allows crawling. The local environment uses
`Disallow: /` and does not advertise the production sitemap. Cloudflare may
prepend zone-managed `robots.txt` groups for named AI training crawlers, so
production validation checks the application's exact `User-agent: *` group.

## Search engine metadata

Indexing is opt-in. The root route sets `robots: noindex`, and a page becomes
indexable only when its route calls `seo({ path })` from
`src/modules/seo/head.ts`. That call adds `index, follow`, the page's only
canonical link, `og:url`, and a preview image drawn on the Worker
([ADR-0018](decisions/0018-preview-images-on-the-worker.md)). The homepage,
the blog index, and each post do this, matching the sitemap. The homepage
also carries `SoftwareSourceCode` JSON-LD for the repository; the blog index
carries `Blog` and each post `BlogPosting` JSON-LD, and a post is an Open
Graph `article` with its own preview image
([ADR-0019](decisions/0019-blog-from-repository-markdown.md)). Every other page calls
`seo({ noindex: true })` for its title, description, and Open Graph text, with
no canonical URL and a text-only link preview.

The homepage advertises these IANA-registered relations:

```http
Link: <https://core.tanbase.dev/llms.txt>; rel="describedby"; type="text/markdown"
Link: <https://core.tanbase.dev/sitemap.xml>; rel="related"; type="application/xml"
Link: <https://core.tanbase.dev/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"
```

The sitemap is also published through the `Sitemap:` directive in production
`robots.txt`. Unregistered relations, such as `sitemap` and `ai-catalog`, are
not used.

The origin policy is:

```http
Content-Signal: ai-train=no, search=yes, ai-input=yes
```

The same directive appears in `robots.txt`; the response header also appears on
the homepage, its Markdown representation, and `llms.txt`. The policy allows
search indexing and agent-time AI input while reserving the content from model
training. Content Signals express a preference and do not technically prevent
access.

## Markdown negotiation

A request for `/` that names `text/markdown` at least as highly as `text/html`
gets the homepage as Markdown:

- `Content-Type: text/markdown; charset=utf-8`
- `Vary: Accept`, which the HTML homepage also sends
- `x-markdown-tokens`, estimated at four characters a token
- The origin `Content-Signal` policy

The page and the Markdown render from `src/modules/seo/homepage.ts`,
including the primitive map, cost model, and install commands. Browsers
never name Markdown and keep getting HTML. Other pages have no Markdown
representation and answer with HTML.

TanStack Start answers a page request that rules HTML out with a 500, so the
Worker passes such requests on as `Accept: text/html`. A missing page returns
404 and a real one renders, whatever the client asked for. API routes and
server functions keep their own negotiation.

This replaces Cloudflare's zone-level Markdown for Agents, which needs a Pro
zone. Leave that feature off: the Worker's own negotiation already answers.

## MCP and OAuth

`/mcp` serves `list_tasks`, `create_task`, and `complete_task` over Streamable
HTTP. An unauthenticated request returns `401` with a `WWW-Authenticate`
challenge naming `/.well-known/oauth-protected-resource/mcp`, which names the
authorization server `https://core.tanbase.dev/api/auth`. Clients register
through Dynamic Client Registration and use the authorization code flow with
PKCE; the person signs in on `/login` and approves on `/oauth/consent`.

Better Auth also serves the metadata at the root
`/.well-known/oauth-protected-resource`, as the MCP specification's fallback
expects. Its `resource` is `https://core.tanbase.dev/mcp`, not the origin, so
strict RFC 9728 validators, including the isitagentready.com scanner, report a
mismatch. That is deliberate: tokens are issued only for `/mcp`, and a
document that names the origin would promise tokens the server cannot issue.

## WebMCP

Every page registers the three task tools with the browser's WebMCP API,
`document.modelContext`, or `navigator.modelContext` in earlier builds. The
tools share their names and schemas with `/mcp` and call server functions
that act as the signed-in session; signed out, they return a message asking
the person to sign in. The page describes each input with a fixed JSON
Schema from `src/modules/mcp/tool-descriptions.ts`, and the server function
validates it with the tool's Zod schema, so the tool code carries no Zod; a
test keeps the two schemas equal. An invalid input comes back as Zod's
message. `list_tasks` is marked read-only and as returning untrusted content.
The tool code, 1.2 KB gzipped, loads only in browsers that expose WebMCP, and
aborting its signal unregisters the tools. Chrome currently exposes WebMCP behind an origin
trial or the `#enable-webmcp-testing` flag.

## Not published

Each of these stays unpublished until the named capability exists:

- **auth.md** needs agent registration: an `/agent/identity` endpoint that
  returns a service-signed identity assertion and a JWT-bearer token exchange.
  TanBase Core issues tokens only to a person who signs in and consents.
- **A2A agent card** needs an A2A agent.
- **OpenAPI** needs a public REST API. The task API is MCP, which the server
  card describes.
- **Web Bot Auth** applies to sites that operate their own crawlers.

Repository operating instructions under `.agents/` or `.claude/` are not public
product skills.

## DNS-AID

DNS for AI Discovery publishes agent endpoints as SVCB records under an
`_agents` label. The current draft is
[draft-mozleywilliams-dnsop-dnsaid-02](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/);
scanners still read the draft-01 name `_mcp._agents.<host>`, and require
answers that a validating resolver has authenticated. Production publishes it:
on 2026-09-26 DNSSEC was enabled for `tanbase.dev` and the record below was
added, and the isitagentready.com DNS-AID check passes with DNSSEC
validation.

The operator publishes it in the Cloudflare dashboard, since the records live
in the zone rather than the repository:

1. **DNS** → **Settings** → **DNSSEC** → **Enable DNSSEC**. With Cloudflare
   Registrar, the DS record reaches the `.dev` registry automatically.
   Confirm with `dig +short DS tanbase.dev` before continuing.
2. Add an SVCB record: name `_mcp._agents.core`, priority `1`, target
   `core.tanbase.dev`, value `alpn="mcp" port=443 mandatory=alpn,port`,
   TTL one hour. It publishes:

   ```dns
   _mcp._agents.core.tanbase.dev. 3600 IN SVCB 1 core.tanbase.dev. alpn="mcp" port=443 mandatory=alpn,port
   ```

3. Check that a validating resolver authenticates it: the `ad` flag must be
   set in `dig +dnssec SVCB _mcp._agents.core.tanbase.dev @1.1.1.1`. Older
   `dig` builds, including the one macOS ships, do not know the `SVCB`
   mnemonic and silently query A records instead; use `-t TYPE64`, which
   prints the record in hex.

The draft has no parameter for an endpoint path, so the record names the host
and port; clients find `/mcp` through the server card. Do not add an `HTTPS`
record with `alpn="mcp"` on `core.tanbase.dev` itself, because browsers read
those.

## Verification

Run the smoke suite against the target:

```sh
pnpm smoke -- --url https://core.tanbase.dev --environment production
```

It checks Markdown negotiation, the 404 for a missing page requested as JSON,
each discovery document's status, type, CORS, and cache policy, that every AI
Catalog entry resolves, that each skill matches its indexed digest, and that
the card and catalog name the configured `/mcp` resource. The
isitagentready.com scan is a useful cross-check but not evidence by itself.

Record the deployed commit, URL, UTC date, and smoke result in
[status](STATUS.md). A local build or Wrangler dry run is not deployment
evidence.

## References

- [Sitemaps XML protocol](https://www.sitemaps.org/protocol.html)
- [Web Linking, RFC 8288](https://www.rfc-editor.org/rfc/rfc8288)
- [IANA Link Relation Types](https://www.iana.org/assignments/link-relations/link-relations.xhtml)
- [Content Signals](https://contentsignals.org/)
- [HTTP Semantics, RFC 9110, section 12.5.1](https://www.rfc-editor.org/rfc/rfc9110#section-12.5.1)
- [API catalog, RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) and [Linkset, RFC 9264](https://www.rfc-editor.org/rfc/rfc9264)
- [OAuth 2.0 Protected Resource Metadata, RFC 9728](https://www.rfc-editor.org/rfc/rfc9728)
- [MCP Server Card, SEP-2127](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127)
- [Agentic Resource Discovery](https://agenticresourcediscovery.org/) and [AI Catalog](https://github.com/Agent-Card/ai-catalog)
- [Agent Skills Discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc)
- [WebMCP](https://webmachinelearning.github.io/webmcp/)
- [auth.md](https://github.com/workos/auth.md)
- [SVCB and HTTPS records, RFC 9460](https://www.rfc-editor.org/rfc/rfc9460)
