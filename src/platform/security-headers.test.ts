import { afterEach, describe, expect, it, vi } from "vitest"

import { log } from "./log"
import { getRequestContext, runWithRequestContext } from "./request-context"
import {
  applySecurityHeaders,
  contentSecurityPolicy,
  createNonce,
} from "./security-headers"

function html(body = "<!doctype html>", init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    ...init,
    headers: { "Content-Type": "text/html; charset=utf-8", ...init.headers },
  })
}

const options = {
  enforceCsp: true,
  nonce: "test-nonce",
  production: true,
  requestId: "ray-123",
}

describe("security headers", () => {
  it("creates unpredictable base64 nonces", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce))
    expect(nonces.size).toBe(50)
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/)
  })

  it("builds a nonce policy that allows only Turnstile off-origin", () => {
    const policy = contentSecurityPolicy("abc", { production: true })

    expect(policy).toContain(
      "script-src 'self' 'nonce-abc' https://challenges.cloudflare.com"
    )
    expect(policy).toContain("frame-src https://challenges.cloudflare.com")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).not.toContain("unsafe-eval")
    expect(policy).toContain("upgrade-insecure-requests")
    expect(contentSecurityPolicy("abc", { production: false })).not.toContain(
      "upgrade-insecure-requests"
    )
  })

  it("secures production documents and keeps the response intact", async () => {
    const response = applySecurityHeaders(
      html("<p>ok</p>", { status: 404, headers: { Link: "</a>; rel=next" } }),
      options
    )

    expect(response.status).toBe(404)
    expect(await response.text()).toBe("<p>ok</p>")
    expect(response.headers.get("Link")).toBe("</a>; rel=next")
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(response.headers.get("X-Frame-Options")).toBe("DENY")
    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    )
    expect(response.headers.get("X-Request-Id")).toBe("ray-123")
    expect(response.headers.get("Strict-Transport-Security")).toMatch(
      /^max-age=63072000/
    )
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "'nonce-test-nonce'"
    )
  })

  it("limits the CSP to documents and HSTS to production", () => {
    const json = applySecurityHeaders(Response.json({ ok: true }), options)
    expect(json.headers.get("Content-Security-Policy")).toBeNull()
    expect(json.headers.get("X-Content-Type-Options")).toBe("nosniff")

    const local = applySecurityHeaders(html(), {
      ...options,
      production: false,
    })
    expect(local.headers.get("Strict-Transport-Security")).toBeNull()
    expect(local.headers.get("Content-Security-Policy")).not.toContain(
      "upgrade-insecure-requests"
    )

    const dev = applySecurityHeaders(html(), { ...options, enforceCsp: false })
    expect(dev.headers.get("Content-Security-Policy")).toBeNull()
  })
})

describe("request-scoped logging", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("adds the request ID to every entry inside a request", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)

    await runWithRequestContext(
      { requestId: "ray-9", nonce: "n" },
      async () => {
        await Promise.resolve()
        expect(getRequestContext()).toEqual({ requestId: "ray-9", nonce: "n" })
        log.info("Email delivery logged without sending.", {
          event: "email.logged",
        })
        log.error("Unhandled request error", { event: "request.failed" })
      }
    )
    log.info("Outside a request")

    expect(info).toHaveBeenNthCalledWith(1, {
      message: "Email delivery logged without sending.",
      requestId: "ray-9",
      event: "email.logged",
    })
    expect(error).toHaveBeenCalledWith({
      message: "Unhandled request error",
      requestId: "ray-9",
      event: "request.failed",
    })
    expect(info).toHaveBeenNthCalledWith(2, {
      message: "Outside a request",
      requestId: undefined,
    })
  })
})
