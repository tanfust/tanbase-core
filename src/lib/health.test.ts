import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { createHealthResponse, normalizeAppEnvironment } from "./health"

function countingDatabase() {
  const state = { queries: 0, failing: false }
  const database = {
    prepare: () => ({
      first: () => {
        state.queries += 1
        return state.failing
          ? Promise.reject(new Error("private database identifier"))
          : Promise.resolve({ healthy: 1 })
      },
    }),
  } as unknown as D1Database
  return { database, state }
}

async function testCache() {
  return {
    cache: await caches.open(`health-${crypto.randomUUID()}`),
    origin: "https://core.tanbase.dev",
  }
}

describe("health response", () => {
  it.each(["local", "production"] as const)(
    "returns the exact contract for %s",
    async (environment) => {
      const response = await createHealthResponse(environment, {
        database: env.DB,
        files: env.FILES,
        realtime: env.BOARD.getByName("health"),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toBe("no-store")
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        service: "tanbase-core",
        environment,
        checks: { database: "ok", files: "ok", realtime: "ok" },
      })
    }
  )

  it("reports optional features as disabled when they are not bound", async () => {
    const response = await createHealthResponse("production", {
      database: env.DB,
      files: null,
      realtime: null,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      checks: { database: "ok", files: "disabled", realtime: "disabled" },
    })
  })

  it("defaults unknown values to local", () => {
    expect(normalizeAppEnvironment("unknown")).toBe("local")
  })

  it("returns a sanitized error when D1 or R2 is unavailable", async () => {
    const { database, state } = countingDatabase()
    state.failing = true
    const files = {
      head: () => Promise.reject(new Error("private bucket detail")),
    } as unknown as R2Bucket
    const realtime = {
      connections: () => Promise.reject(new Error("private room detail")),
    }

    const response = await createHealthResponse("production", {
      database,
      files,
      realtime,
    })
    const body = await response.clone().text()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      status: "error",
      service: "tanbase-core",
      environment: "production",
      checks: { database: "error", files: "error", realtime: "error" },
    })
    expect(body).not.toContain("private")
  })

  it("reuses successful checks and never caches failures", async () => {
    const { database, state } = countingDatabase()
    let probes = 0
    const files = {
      head: () => {
        probes += 1
        return Promise.resolve(null)
      },
    } as unknown as R2Bucket
    const cache = await testCache()

    for (let request = 0; request < 3; request += 1) {
      const response = await createHealthResponse("production", {
        cache,
        database,
        files,
      })
      expect(response.status).toBe(200)
    }
    expect(state.queries).toBe(1)
    expect(probes).toBe(1)

    await cache.cache.delete(`${cache.origin}/api/health/database-check`)
    state.failing = true
    for (let request = 0; request < 2; request += 1) {
      const response = await createHealthResponse("production", {
        cache,
        database,
        files,
      })
      expect(response.status).toBe(503)
    }
    expect(state.queries).toBe(3)
    expect(probes).toBe(1)
  })
})
