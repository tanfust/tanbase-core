import { env } from "cloudflare:workers"
import {
  createMcpHandler,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/server"
import { describe, expect, it } from "vitest"

import { siteConfig } from "@/lib/site"
import { createTasksMcpServer } from "@/modules/mcp/server.server"

import {
  createAiCatalog,
  createApiCatalog,
  createLegacyMcpServerCard,
  createMcpServerCard,
  createSkillsIndex,
  mcpProtocolVersions,
  parseSkill,
  sha256Hex,
  skills,
} from "./documents"
import { discoveryResponse, isDiscoveryPath } from "./well-known"

// A fork's origin, so each test proves documents follow the deployment.
const origin = "https://tasks.example.dev"
const skillPath = `/.well-known/agent-skills/${siteConfig.id}-tasks/SKILL.md`

async function mcp(method: string, params?: unknown) {
  const handler = createMcpHandler(() =>
    createTasksMcpServer("discovery-test", env.DB)
  )
  const response = await handler.fetch(
    new Request(`${origin}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-06-18",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })
  )
  const text = await response.text()
  const json = text.startsWith("{")
    ? text
    : text
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length)
  return (JSON.parse(json ?? "null") as { result: Record<string, unknown> })
    .result
}

describe("MCP server card", () => {
  it("follows the server card schema", () => {
    const card = createMcpServerCard(origin)

    expect(card.$schema).toBe(
      "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json"
    )
    expect(card.name).toBe(`dev.example.tasks/${siteConfig.id}`)
    expect(card.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/)
    expect(card.description.length).toBeGreaterThan(0)
    expect(card.description.length).toBeLessThanOrEqual(100)
    expect(card.remotes).toEqual([
      expect.objectContaining({
        type: "streamable-http",
        url: `${origin}/mcp`,
      }),
    ])
  })

  it("advertises only protocol revisions the SDK serves over Streamable HTTP", () => {
    const [modern, ...legacy] = mcpProtocolVersions
    expect(modern).toBe("2026-07-28")
    expect(legacy[0]).toBe(LATEST_PROTOCOL_VERSION)
    for (const version of legacy) {
      expect(SUPPORTED_PROTOCOL_VERSIONS).toContain(version)
    }
    // Earlier revisions used the retired HTTP+SSE transport.
    expect(legacy).not.toContain("2024-11-05")
  })

  it("matches what /mcp reports at the draft's well-known path", async () => {
    const card = createLegacyMcpServerCard(origin)
    const initialized = await mcp("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "discovery-test", version: "1.0.0" },
    })
    const listed = await mcp("tools/list")

    expect(initialized.serverInfo).toMatchObject(card.serverInfo)
    expect(initialized.capabilities).toMatchObject(card.capabilities)
    expect(card.tools).toEqual(
      (
        listed.tools as { name: string; title: string; description: string }[]
      ).map(({ name, title, description }) => ({ name, title, description }))
    )
    expect(card.transport.endpoint).toBe(`${origin}/mcp`)
    expect(card.authentication.protectedResourceMetadata).toBe(
      `${origin}/.well-known/oauth-protected-resource/mcp`
    )
  })
})

describe("API catalog", () => {
  it("is an RFC 9264 linkset whose only member is linkset", () => {
    const catalog = createApiCatalog(origin)

    expect(Object.keys(catalog)).toEqual(["linkset"])
    expect(catalog.linkset).toEqual([
      {
        anchor: `${origin}/mcp`,
        "service-desc": [
          {
            href: `${origin}/mcp/server-card`,
            type: "application/mcp-server-card+json",
          },
        ],
        "service-doc": [
          {
            href: `${origin}${skillPath}`,
            type: "text/markdown",
          },
        ],
        status: [{ href: `${origin}/api/health`, type: "application/json" }],
      },
    ])
  })
})

describe("AI catalog", () => {
  it("gives every entry a URN, a name, a type, one reference, and 2–5 queries", () => {
    const catalog = createAiCatalog(origin)

    expect(catalog.specVersion).toBe("1.0")
    expect(catalog.host).toMatchObject({
      displayName: siteConfig.name,
      identifier: "tasks.example.dev",
    })
    expect(catalog.entries.length).toBeGreaterThan(0)
    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(
        /^urn:air:tasks\.example\.dev:[a-z]+:[a-z-]+$/
      )
      expect(entry.displayName.length).toBeGreaterThan(0)
      expect(entry.type).toMatch(/^application\/[a-z0-9.+-]+$/)
      expect(entry.url.startsWith(`${origin}/`)).toBe(true)
      expect(entry).not.toHaveProperty("data")
      expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2)
      expect(entry.representativeQueries.length).toBeLessThanOrEqual(5)
    }
    const identifiers = catalog.entries.map(({ identifier }) => identifier)
    expect(new Set(identifiers).size).toBe(identifiers.length)
  })

  it("points only at documents this Worker serves", () => {
    for (const { url } of createAiCatalog(origin).entries) {
      expect(isDiscoveryPath(new URL(url).pathname)).toBe(true)
    }
  })
})

describe("agent skills", () => {
  it("indexes each skill with the digest of the bytes it serves", async () => {
    const index = await createSkillsIndex(origin)

    expect(index.$schema).toBe(
      "https://schemas.agentskills.io/discovery/0.2.0/schema.json"
    )
    expect(index.skills).toHaveLength(skills.length)
    for (const [position, entry] of index.skills.entries()) {
      const skill = skills[position]
      expect(entry).toEqual({
        name: skill.name,
        type: "skill-md",
        description: skill.description,
        url: skill.path,
        digest: `sha256:${await sha256Hex(skill.content(origin))}`,
      })
      expect(entry.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    }
  })

  it("names each skill after its directory, within the spec's limits", () => {
    for (const skill of skills) {
      expect(skill.name).toMatch(/^[a-z0-9-]{1,64}$/)
      expect(skill.path).toBe(
        `/.well-known/agent-skills/${skill.name}/SKILL.md`
      )
      expect(skill.description.length).toBeLessThanOrEqual(1024)
    }
  })

  it("requires name and description frontmatter", () => {
    expect(() => parseSkill("# No frontmatter\n")).toThrow(/no name/)
  })

  it("serves each skill with this app's name and the deployment's origin", () => {
    for (const skill of skills) {
      const content = skill.content(origin)
      expect(skill.name).toBe(`${siteConfig.id}-tasks`)
      expect(content).toContain(`${siteConfig.name} tasks`)
      expect(content).toContain(`${origin}/mcp`)
      expect(content).not.toContain(siteConfig.origin)
      expect(content).not.toContain("{{")
    }
  })
})

describe("discovery responses", () => {
  const get = (path: string, init?: RequestInit) =>
    discoveryResponse(new Request(`${origin}${path}`, init), origin)

  it.each([
    [
      "/.well-known/api-catalog",
      'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
    ],
    ["/.well-known/ai-catalog.json", "application/ai-catalog+json"],
    ["/.well-known/ard.json", "application/ai-catalog+json"],
    ["/mcp/server-card", "application/mcp-server-card+json"],
    ["/.well-known/mcp/server-card.json", "application/json"],
    ["/.well-known/agent-skills/index.json", "application/json"],
    [skillPath, "text/markdown; charset=utf-8"],
  ])("serves %s as %s to any origin", async (path, contentType) => {
    const response = await get(path)

    expect(response?.status).toBe(200)
    expect(response?.headers.get("Content-Type")).toBe(contentType)
    expect(response?.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response?.headers.get("Cache-Control")).toBe("public, max-age=300")
    expect(response?.headers.get("ETag")).toMatch(/^"[0-9a-f]{32}"$/)
  })

  it("serves each skill's exact bytes", async () => {
    for (const skill of skills) {
      const response = await get(skill.path)
      await expect(response?.text()).resolves.toBe(skill.content(origin))
    }
  })

  it("answers a HEAD for the API catalog with its api-catalog link", async () => {
    const response = await get("/.well-known/api-catalog", { method: "HEAD" })

    expect(response?.status).toBe(200)
    expect(response?.headers.get("Link")).toBe(
      `<${origin}/.well-known/api-catalog>; rel="api-catalog"`
    )
    await expect(response?.text()).resolves.toBe("")
  })

  it("answers a matching If-None-Match with 304", async () => {
    const etag = (await get("/mcp/server-card"))?.headers.get("ETag") ?? ""
    const response = await get("/mcp/server-card", {
      headers: { "If-None-Match": etag },
    })

    expect(response?.status).toBe(304)
    await expect(response?.text()).resolves.toBe("")
  })

  it("answers preflights and rejects writes", async () => {
    const preflight = await get("/mcp/server-card", { method: "OPTIONS" })
    expect(preflight?.status).toBe(204)
    expect(preflight?.headers.get("Access-Control-Allow-Headers")).toContain(
      "If-None-Match"
    )

    const write = await get("/.well-known/ai-catalog.json", { method: "POST" })
    expect(write?.status).toBe(405)
    expect(write?.headers.get("Allow")).toBe("GET, HEAD, OPTIONS")
  })

  it("leaves other paths to the rest of the Worker", async () => {
    await expect(get("/")).resolves.toBeNull()
    await expect(get("/mcp")).resolves.toBeNull()
    await expect(
      get("/.well-known/oauth-protected-resource")
    ).resolves.toBeNull()
  })
})
