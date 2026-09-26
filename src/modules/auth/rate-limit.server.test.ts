import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import type { AuthRateLimiter } from "./rate-limit.server"
import { limitAuthRequest } from "./rate-limit.server"

function recordingLimiter(success: boolean) {
  const keys: string[] = []
  const limiter: AuthRateLimiter = {
    limit: async ({ key }) => {
      keys.push(key)
      return { success }
    },
  }
  return { keys, limiter }
}

function authRequest(
  path: string,
  method = "POST",
  headers?: Record<string, string>
) {
  return new Request(`https://core.tanbase.dev/api/auth${path}`, {
    method,
    headers,
  })
}

describe("auth rate limiting", () => {
  it("keys sensitive endpoints by Cloudflare client IP and endpoint", async () => {
    const { keys, limiter } = recordingLimiter(true)

    const response = await limitAuthRequest(
      authRequest("/sign-in/email", "POST", {
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": "198.51.100.1",
      }),
      limiter
    )

    expect(response).toBeNull()
    expect(keys).toEqual(["203.0.113.7:/sign-in/email"])
  })

  it("returns a sanitized 429 when the limit is exceeded", async () => {
    const { limiter } = recordingLimiter(false)

    const response = await limitAuthRequest(
      authRequest("/sign-up/email"),
      limiter
    )

    expect(response?.status).toBe(429)
    expect(response?.headers.get("retry-after")).toBe("60")
    expect(response?.headers.get("cache-control")).toBe("no-store")
    expect(await response?.json()).toEqual({
      code: "RATE_LIMITED",
      message: "Too many attempts. Wait a minute and try again.",
    })
  })

  it("limits unauthenticated OAuth client registration but not token exchange", async () => {
    const { keys, limiter } = recordingLimiter(false)

    const registration = await limitAuthRequest(
      authRequest("/oauth2/register", "POST", {
        "cf-connecting-ip": "203.0.113.9",
      }),
      limiter
    )
    expect(registration?.status).toBe(429)
    expect(
      await limitAuthRequest(authRequest("/oauth2/token"), limiter)
    ).toBeNull()
    expect(keys).toEqual(["203.0.113.9:/oauth2/register"])
  })

  it("leaves session reads and unlisted endpoints unlimited", async () => {
    const { keys, limiter } = recordingLimiter(false)

    expect(
      await limitAuthRequest(authRequest("/get-session", "GET"), limiter)
    ).toBeNull()
    expect(
      await limitAuthRequest(authRequest("/sign-in/email", "GET"), limiter)
    ).toBeNull()
    expect(await limitAuthRequest(authRequest("/sign-out"), limiter)).toBeNull()
    expect(keys).toEqual([])
  })

  it("is bound to the AUTH_LIMITER rate-limit binding", async () => {
    const response = await limitAuthRequest(
      authRequest("/request-password-reset", "POST", {
        "cf-connecting-ip": `test-${crypto.randomUUID()}`,
      }),
      env.AUTH_LIMITER
    )

    expect(response).toBeNull()
  })
})
