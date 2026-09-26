// POST endpoints that check credentials, create accounts, consume reset
// tokens, send email, or register OAuth clients without authentication.
// Session reads, sign-out, and token exchange stay unlimited.
export const rateLimitedAuthEndpoints = new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
  "/send-verification-email",
  "/reset-password",
  "/oauth2/register",
])

const authBasePath = "/api/auth"
const retryAfterSeconds = 60

export interface AuthRateLimiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>
}

function authEndpoint(request: Request) {
  const { pathname } = new URL(request.url)
  if (!pathname.startsWith(`${authBasePath}/`)) return null
  return pathname.slice(authBasePath.length).replace(/\/+$/, "")
}

/**
 * Applies the per-IP, per-endpoint AUTH_LIMITER to sensitive auth requests.
 * Returns a 429 response when the caller is over the limit, or null when the
 * request may continue to Better Auth.
 */
export async function limitAuthRequest(
  request: Request,
  limiter: AuthRateLimiter
): Promise<Response | null> {
  if (request.method !== "POST") return null

  const endpoint = authEndpoint(request)
  if (!endpoint || !rateLimitedAuthEndpoints.has(endpoint)) return null

  // cf-connecting-ip is set by Cloudflare. Local requests share one bucket.
  const ip = request.headers.get("cf-connecting-ip") ?? "local"
  const { success } = await limiter.limit({ key: `${ip}:${endpoint}` })
  if (success) return null

  return Response.json(
    {
      code: "RATE_LIMITED",
      message: "Too many attempts. Wait a minute and try again.",
    },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(retryAfterSeconds),
      },
    }
  )
}
