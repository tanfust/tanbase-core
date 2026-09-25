const turnstileOrigin = "https://challenges.cloudflare.com"

export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Nonce-based policy for server-rendered documents. The router and ScriptOnce
 * stamp the nonce on the inline scripts they emit; module scripts and chunks
 * load from 'self'. Turnstile needs its script and frame origin.
 */
export function contentSecurityPolicy(
  nonce: string,
  {
    connectSources = [],
    production,
  }: { connectSources?: readonly string[]; production: boolean }
): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${turnstileOrigin}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    ["connect-src 'self'", ...connectSources].join(" "),
    `frame-src ${turnstileOrigin}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ]
  if (production) directives.push("upgrade-insecure-requests")
  return directives.join("; ")
}

export const baseSecurityHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const

export const strictTransportSecurity = "max-age=63072000; includeSubDomains"

interface SecurityHeaderOptions {
  /** Extra origins the page may fetch from, such as enabled analytics. */
  connectSources?: readonly string[]
  /** Apply the CSP. Off for the Vite dev server, whose client needs inline code. */
  enforceCsp: boolean
  nonce: string
  production: boolean
  requestId: string
}

export function applySecurityHeaders(
  response: Response,
  {
    connectSources,
    enforceCsp,
    nonce,
    production,
    requestId,
  }: SecurityHeaderOptions
): Response {
  const secured = new Response(response.body, response)
  const { headers } = secured

  for (const [name, value] of Object.entries(baseSecurityHeaders)) {
    headers.set(name, value)
  }
  headers.set("X-Request-Id", requestId)
  if (production)
    headers.set("Strict-Transport-Security", strictTransportSecurity)

  const isHtml = (headers.get("Content-Type") ?? "")
    .toLowerCase()
    .startsWith("text/html")
  if (enforceCsp && isHtml) {
    headers.set(
      "Content-Security-Policy",
      contentSecurityPolicy(nonce, { connectSources, production })
    )
  }

  return secured
}
