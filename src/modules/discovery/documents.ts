import { fillTemplate, siteConfig } from "@/lib/site"
import { mcpServerInfo, taskTools } from "@/modules/mcp/tool-definitions"

import tasksSkillTemplate from "./skills/tasks/SKILL.md?raw"

/**
 * Agent discovery documents. Each one describes only what this deployment
 * serves: the `/mcp` server, its OAuth authorization server, the health
 * endpoint, and the curated product skill. `origin` is the deployment's
 * public origin, the one its OAuth issuer and MCP resource derive from.
 */

/** MCP protocol revisions `/mcp` answers, newest first. */
export const mcpProtocolVersions = [
  "2026-07-28",
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
] as const

export const mcpServerCardPath = "/mcp/server-card"
export const skillsIndexPath = "/.well-known/agent-skills/index.json"

export interface Skill {
  name: string
  description: string
  path: string
  /** The SKILL.md this deployment serves, naming its own origin. */
  content: (origin: string) => string
}

/**
 * Reads `name` and `description` from a SKILL.md template's YAML
 * frontmatter. Neither may name the origin: they are the same everywhere.
 */
export function parseSkill(template: string): Skill {
  const branded = fillTemplate(template, siteConfig.origin)
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(branded)?.[1] ?? ""
  const field = (key: string) => {
    const value = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(frontmatter)?.[1]
    if (!value) throw new Error(`A SKILL.md has no ${key} in its frontmatter`)
    if (value.includes(siteConfig.origin)) {
      throw new Error(`A SKILL.md ${key} names an origin`)
    }
    return value.trim()
  }
  const name = field("name")
  return {
    name,
    description: field("description"),
    path: `/.well-known/agent-skills/${name}/SKILL.md`,
    content: (origin) => fillTemplate(template, origin),
  }
}

export const skills: readonly Skill[] = [parseSkill(tasksSkillTemplate)]

const cardDescription = `List, create, and complete tasks on a person's ${siteConfig.name} board.`

/** Reverse-DNS namespace for server card names, e.g. `dev.example.tasks`. */
function reverseDns(origin: string) {
  return new URL(origin).hostname.split(".").reverse().join(".")
}

/**
 * MCP Server Card (SEP-2127, `io.modelcontextprotocol/server-card`). It names
 * the server and its remote transport; tools and auth are discovered at
 * runtime through MCP and RFC 9728, as the extension requires.
 */
export function createMcpServerCard(origin: string) {
  return {
    $schema:
      "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: `${reverseDns(origin)}/${mcpServerInfo.name}`,
    version: mcpServerInfo.version,
    description: cardDescription,
    title: mcpServerInfo.title,
    websiteUrl: `${origin}/`,
    repository: { url: siteConfig.sourceRepository, source: "github" },
    remotes: [
      {
        type: "streamable-http",
        url: `${origin}/mcp`,
        supportedProtocolVersions: [...mcpProtocolVersions],
      },
    ],
  }
}

/**
 * The same card at the well-known path of the earlier SEP-1649 draft, with
 * that draft's `serverInfo`, `transport`, `capabilities`, and `tools` fields
 * for the clients and scanners that still read it. The tools come from the
 * definitions `/mcp` registers, so the list cannot go stale.
 */
export function createLegacyMcpServerCard(origin: string) {
  return {
    ...createMcpServerCard(origin),
    serverInfo: { ...mcpServerInfo },
    protocolVersion: mcpProtocolVersions[0],
    transport: { type: "streamable-http", endpoint: `${origin}/mcp` },
    capabilities: { tools: { listChanged: true } },
    authentication: {
      required: true,
      schemes: ["oauth2"],
      protectedResourceMetadata: `${origin}/.well-known/oauth-protected-resource/mcp`,
    },
    tools: taskTools.map(({ name, title, description }) => ({
      name,
      title,
      description,
    })),
  }
}

/** RFC 9727 API catalog: an RFC 9264 linkset, one entry per API. */
export function createApiCatalog(origin: string) {
  const [tasksSkill] = skills
  return {
    linkset: [
      {
        anchor: `${origin}/mcp`,
        "service-desc": [
          {
            href: `${origin}${mcpServerCardPath}`,
            type: "application/mcp-server-card+json",
          },
        ],
        "service-doc": [
          {
            href: `${origin}${tasksSkill.path}`,
            type: "text/markdown",
          },
        ],
        status: [{ href: `${origin}/api/health`, type: "application/json" }],
      },
    ],
  }
}

/**
 * Agentic Resource Discovery manifest (an AI Catalog). Entries reference the
 * server card, the skill, and the API catalog rather than inlining them.
 */
export function createAiCatalog(origin: string) {
  const host = new URL(origin).hostname
  const urn = (namespace: string, name: string) =>
    `urn:air:${host}:${namespace}:${name}`

  return {
    specVersion: "1.0",
    host: {
      displayName: siteConfig.name,
      identifier: host,
      documentationUrl: `${origin}/llms.txt`,
    },
    entries: [
      {
        identifier: urn("mcp", mcpServerInfo.name),
        displayName: mcpServerInfo.title,
        type: "application/mcp-server-card+json",
        url: `${origin}${mcpServerCardPath}`,
        description: cardDescription,
        capabilities: taskTools.map(({ name }) => name),
        representativeQueries: [
          "what tasks are due this week",
          "add a task to my board",
          "mark a task as done",
        ],
      },
      ...skills.map((skill) => ({
        identifier: urn("skill", skill.name),
        displayName: `${siteConfig.name} tasks skill`,
        type: "application/agent-skills+md",
        url: `${origin}${skill.path}`,
        description: skill.description,
        representativeQueries: [
          `how do I connect an agent to ${siteConfig.name}`,
          `manage my ${siteConfig.name} tasks from an agent`,
        ],
      })),
      {
        identifier: urn("api", "catalog"),
        displayName: `${siteConfig.name} API catalog`,
        type: "application/linkset+json",
        url: `${origin}/.well-known/api-catalog`,
        description: "RFC 9727 catalog of the public APIs on this origin.",
        representativeQueries: [
          `list the ${siteConfig.name} APIs`,
          `find the ${siteConfig.name} MCP endpoint`,
        ],
      },
    ],
  }
}

/** Lowercase hex SHA-256 of a text's UTF-8 bytes. */
export async function sha256Hex(content: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content)
  )
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

/** Agent Skills Discovery index, v0.2.0, for one deployment's origin. */
export async function createSkillsIndex(origin: string) {
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: await Promise.all(
      skills.map(async ({ name, description, path, content }) => ({
        name,
        type: "skill-md",
        description,
        url: path,
        digest: `sha256:${await sha256Hex(content(origin))}`,
      }))
    ),
  }
}
