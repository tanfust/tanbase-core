import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { createHealthResponse, normalizeAppEnvironment } from "./health"

describe("health response", () => {
  it.each(["local", "preview", "production"] as const)(
    "returns the exact contract for %s",
    async (environment) => {
      const response = await createHealthResponse(environment, env.DB)

      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toBe("no-store")
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        service: "tanbase-core",
        environment,
        checks: { database: "ok" },
      })
    }
  )

  it("defaults unknown values to local", () => {
    expect(normalizeAppEnvironment("unknown")).toBe("local")
  })

  it("returns a sanitized error when D1 is unavailable", async () => {
    const database = {
      prepare: () => ({
        first: () => Promise.reject(new Error("private database identifier")),
      }),
    } as unknown as D1Database

    const response = await createHealthResponse("production", database)
    const body = await response.clone().text()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      status: "error",
      service: "tanbase-core",
      environment: "production",
      checks: { database: "error" },
    })
    expect(body).not.toContain("private")
  })
})
