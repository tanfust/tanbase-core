import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider"

import { getAuth } from "@/modules/auth/auth.server"
import type { Auth } from "@/modules/auth/auth.server"

// Better Auth lives under /api/auth, so MCP clients look for its discovery
// documents at the root with that path inserted (RFC 8414 and RFC 9728).
const authorizationServerPaths = new Set([
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-authorization-server/api/auth",
])
const openIdConfigurationPaths = new Set([
  "/.well-known/openid-configuration",
  "/.well-known/openid-configuration/api/auth",
])
const protectedResourcePaths = new Set([
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/mcp",
])

/** Serves OAuth discovery at the root, or returns null for other paths. */
export function oauthDiscoveryResponse(
  request: Request,
  auth: () => Auth = getAuth
): Promise<Response> | null {
  const { pathname } = new URL(request.url)
  if (authorizationServerPaths.has(pathname)) {
    return oauthProviderAuthServerMetadata(auth())(request)
  }
  if (openIdConfigurationPaths.has(pathname)) {
    return oauthProviderOpenIdConfigMetadata(auth())(request)
  }
  // The MCP plugin answers these itself, before Better Auth's routing.
  if (protectedResourcePaths.has(pathname)) return auth().handler(request)
  return null
}

// Public, cookie-free OAuth and MCP endpoints that browser-based MCP clients,
// such as MCP Inspector, call across origins.
const corsExactPaths = new Set([
  "/mcp",
  "/api/auth/jwks",
  "/api/auth/oauth2/register",
  "/api/auth/oauth2/token",
  "/api/auth/oauth2/revoke",
])

export function isCorsPath(pathname: string): boolean {
  return (
    corsExactPaths.has(pathname) ||
    authorizationServerPaths.has(pathname) ||
    openIdConfigurationPaths.has(pathname) ||
    protectedResourcePaths.has(pathname)
  )
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, DPoP, Last-Event-ID, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers":
    "WWW-Authenticate, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export function withCors(response: Response): Response {
  for (const [name, value] of Object.entries(corsHeaders)) {
    response.headers.set(name, value)
  }
  return response
}
