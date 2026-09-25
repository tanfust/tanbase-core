import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { createHealthResponse, normalizeAppEnvironment } from "./health"

describe("health response", () => {
  it.each(["local", "production"] as const)(
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

  it("reuses a successful database check and never caches failures", async () => {
    let queries = 0
    let failing = false
    const database = {
      prepare: () => ({
        first: () => {
          queries += 1
          return failing
            ? Promise.reject(new Error("unavailable"))
            : Promise.resolve({ healthy: 1 })
        },
      }),
    } as unknown as D1Database
    const cached = {
      cache: await caches.open(`health-${crypto.randomUUID()}`),
      key: "https://core.tanbase.dev/api/health/database-check",
    }

    for (let request = 0; request < 3; request += 1) {
      const response = await createHealthResponse(
        "production",
        database,
        cached
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toBe("no-store")
    }
    expect(queries).toBe(1)

    await cached.cache.delete(cached.key)
    failing = true
    expect(
      (await createHealthResponse("production", database, cached)).status
    ).toBe(503)
    expect(
      (await createHealthResponse("production", database, cached)).status
    ).toBe(503)
    expect(queries).toBe(3)
  })

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
