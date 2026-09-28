import { describe, expect, it } from "vitest"

import {
  authErrorMessage,
  edgeErrorResponse,
  workerResourceLimitCode,
} from "./errors"

function errorPage(body: string, headers: Record<string, string> = {}) {
  return new Response(body, {
    status: 503,
    headers: { "content-type": "text/html; charset=UTF-8", ...headers },
  })
}

describe("edgeErrorResponse", () => {
  it("names a Worker over its CPU limit from Cloudflare's header", async () => {
    const response = await edgeErrorResponse(
      errorPage("<html></html>", { "cf-error-type": "1102" })
    )
    expect(response?.status).toBe(503)
    const body = (await response?.json()) as { code: string; message: string }
    expect(body.code).toBe(workerResourceLimitCode)
    expect(body.message).toContain("Workers Paid")
  })

  it("names it from an error page that says 1102", async () => {
    const response = await edgeErrorResponse(
      errorPage("<title>Worker exceeded resource limits | Error 1102</title>")
    )
    expect(response).toBeDefined()
  })

  it("leaves every other response alone", async () => {
    expect(await edgeErrorResponse(new Response("ok"))).toBeUndefined()
    expect(
      await edgeErrorResponse(errorPage("<title>Error 1101</title>"))
    ).toBeUndefined()
    expect(
      await edgeErrorResponse(
        Response.json({ code: "INVALID_PASSWORD" }, { status: 401 })
      )
    ).toBeUndefined()
  })
})

describe("authErrorMessage", () => {
  it("shows the CPU limit message", () => {
    expect(
      authErrorMessage({ code: workerResourceLimitCode, status: 503 }, "x")
    ).toContain("error 1102")
  })

  it("keeps the other mappings", () => {
    expect(authErrorMessage({ status: 429 }, "x")).toContain("Too many")
    expect(authErrorMessage({ message: "Invalid password" }, "x")).toBe(
      "Invalid password"
    )
    expect(authErrorMessage({}, "fallback")).toBe("fallback")
  })
})
