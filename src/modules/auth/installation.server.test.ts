import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import {
  authSecretUsable,
  findInstallationProblem,
} from "./installation.server"
import { hasAuthTables } from "./repository.server"
import { getPageSession } from "./session.server"

const usableSecret = "test-only-secret-that-is-at-least-32-characters"

/** A D1 stand-in whose schema lookup finds nothing, or fails. */
function emptyDatabase({ fails = false } = {}) {
  let queries = 0
  const database = {
    prepare: () => ({
      first: async () => {
        queries += 1
        if (fails) throw new Error("D1 is unavailable")
        return null
      },
    }),
  } as unknown as D1Database
  return { database, queries: () => queries }
}

describe("hasAuthTables", () => {
  it("finds the tables the migrations create", async () => {
    expect(await hasAuthTables(env.DB)).toBe(true)
    expect(await hasAuthTables(emptyDatabase().database)).toBe(false)
  })
})

describe("authSecretUsable", () => {
  it("accepts a secret of 32 characters or more", () => {
    expect(authSecretUsable(usableSecret)).toBe(true)
    expect(authSecretUsable("a".repeat(32))).toBe(true)
    expect(authSecretUsable("paste-a-random-secret")).toBe(false)
    expect(authSecretUsable("")).toBe(false)
    expect(authSecretUsable(undefined)).toBe(false)
  })
})

describe("findInstallationProblem", () => {
  it("reports a database without tables before a missing secret", async () => {
    const { database } = emptyDatabase()
    expect(await findInstallationProblem({ DB: database })).toBe("database")
    expect(
      await findInstallationProblem({
        DB: database,
        BETTER_AUTH_SECRET: usableSecret,
      })
    ).toBe("database")
  })

  it("reports a missing or short secret once the database is ready", async () => {
    expect(await findInstallationProblem({ DB: env.DB })).toBe("secret")
    expect(
      await findInstallationProblem({
        DB: env.DB,
        BETTER_AUTH_SECRET: "paste-a-random-secret",
      })
    ).toBe("secret")
    expect(
      await findInstallationProblem({
        DB: env.DB,
        BETTER_AUTH_SECRET: usableSecret,
      })
    ).toBeNull()
  })

  it("checks an empty database again, so a later migration counts", async () => {
    const empty = emptyDatabase()
    await findInstallationProblem({ DB: empty.database })
    await findInstallationProblem({ DB: empty.database })
    expect(empty.queries()).toBe(2)
  })

  it("does not blame the database when the check itself fails", async () => {
    const { database } = emptyDatabase({ fails: true })
    expect(
      await findInstallationProblem({
        DB: database,
        BETTER_AUTH_SECRET: usableSecret,
      })
    ).toBeNull()
  })
})

describe("getPageSession", () => {
  const headers = new Headers()
  const unconfigured = () => Promise.reject(new Error("not configured"))

  it("returns the session", async () => {
    const session = { user: { id: "u" } }
    const lookup = () => Promise.resolve(session)
    expect(
      await getPageSession(headers, {
        lookup: lookup as never,
        problem: async () => null,
      })
    ).toBe(session)
  })

  it("reads as signed out on an unfinished deployment", async () => {
    expect(
      await getPageSession(headers, {
        lookup: unconfigured,
        problem: async () => "database" as const,
      })
    ).toBeNull()
  })

  it("rethrows when the deployment is set up", async () => {
    await expect(
      getPageSession(headers, {
        lookup: unconfigured,
        problem: async () => null,
      })
    ).rejects.toThrow("not configured")
  })
})
