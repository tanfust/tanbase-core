import { discoveryCacheControl } from "@/modules/seo/discovery"

import {
  createAiCatalog,
  createApiCatalog,
  createLegacyMcpServerCard,
  createMcpServerCard,
  createSkillsIndex,
  mcpServerCardPath,
  sha256Hex,
  skills,
  skillsIndexPath,
} from "./documents"

interface Document {
  body: (origin: string) => string | Promise<string>
  contentType: string
  headers?: (origin: string) => Record<string, string>
}

const json = (value: unknown) => JSON.stringify(value, null, 2)

const aiCatalog: Document = {
  body: (origin) => json(createAiCatalog(origin)),
  // AI Catalog names application/ai-catalog+json, which is not registered
  // yet; consumers accept any JSON type and the ARD check expects this one.
  contentType: "application/json",
}

const documents = new Map<string, Document>([
  [
    "/.well-known/api-catalog",
    {
      body: (origin) => json(createApiCatalog(origin)),
      contentType:
        'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
      // RFC 9727 section 2: HEAD answers with the catalog's own link.
      headers: (origin) => ({
        Link: `<${origin}/.well-known/api-catalog>; rel="api-catalog"`,
      }),
    },
  ],
  ["/.well-known/ai-catalog.json", aiCatalog],
  // ARD v0.91 renamed the manifest; both names serve the same document.
  ["/.well-known/ard.json", aiCatalog],
  [
    mcpServerCardPath,
    {
      body: (origin) => json(createMcpServerCard(origin)),
      contentType: "application/mcp-server-card+json",
    },
  ],
  [
    "/.well-known/mcp/server-card.json",
    {
      body: (origin) => json(createLegacyMcpServerCard(origin)),
      contentType: "application/json",
    },
  ],
  [
    skillsIndexPath,
    {
      body: async () => json(await createSkillsIndex()),
      contentType: "application/json",
    },
  ],
  ...skills.map((skill): [string, Document] => [
    skill.path,
    {
      body: () => skill.content,
      contentType: "text/markdown; charset=utf-8",
    },
  ]),
])

export function isDiscoveryPath(pathname: string): boolean {
  return documents.has(pathname)
}

// Public, credential-free documents that any origin may read.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
  "Access-Control-Expose-Headers": "ETag, Link",
  "Access-Control-Max-Age": "86400",
}

/**
 * Serves the agent discovery documents at their fixed paths, or returns
 * null for other paths. `origin` is the deployment's public origin.
 */
export async function discoveryResponse(
  request: Request,
  origin: string
): Promise<Response | null> {
  const document = documents.get(new URL(request.url).pathname)
  if (!document) return null

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { ...corsHeaders, Allow: "GET, HEAD, OPTIONS" },
    })
  }

  const body = await document.body(origin)
  const etag = `"${(await sha256Hex(body)).slice(0, 32)}"`
  const headers = {
    ...corsHeaders,
    ...document.headers?.(origin),
    "Cache-Control": discoveryCacheControl,
    "Content-Type": document.contentType,
    ETag: etag,
  }

  const cached = request.headers
    .get("If-None-Match")
    ?.split(",")
    .some((tag) => tag.trim() === etag || tag.trim() === "*")
  if (cached) return new Response(null, { status: 304, headers })

  return new Response(request.method === "HEAD" ? null : body, { headers })
}
