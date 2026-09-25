export const appEnvironments = ["local", "production"] as const

export type AppEnvironment = (typeof appEnvironments)[number]

export function normalizeAppEnvironment(value: string): AppEnvironment {
  return appEnvironments.includes(value as AppEnvironment)
    ? (value as AppEnvironment)
    : "local"
}

// A successful check is reused for this long in each Cloudflare location, so a
// public health endpoint cannot turn into unbounded D1 or R2 load.
export const healthCheckCacheSeconds = 30

type CheckStatus = "ok" | "error"

interface HealthCache {
  cache: Cache
  /** Serving origin; each check is cached under a path on it. */
  origin: string
}

interface RealtimeProbe {
  /** RPC on a dedicated room; proves the Durable Object class is deployed. */
  connections: () => Promise<number>
}

interface HealthDependencies {
  database: D1Database
  /** The FILES bucket, or null when the installation has none. */
  files?: R2Bucket | null
  /** The health room, or null when the installation has no BOARD binding. */
  realtime?: RealtimeProbe | null
  /** The running Worker version, so deploy smoke can wait for it. */
  version?: string | null
  cache?: HealthCache
}

async function cachedCheck(
  name: string,
  probe: () => Promise<unknown>,
  cached?: HealthCache
): Promise<CheckStatus> {
  const key = cached && new URL(`/api/health/${name}-check`, cached.origin).href
  if (cached && key && (await cached.cache.match(key))) return "ok"

  try {
    await probe()
  } catch {
    // Failures are never cached, so recovery is visible on the next request.
    return "error"
  }

  if (cached && key) {
    await cached.cache.put(
      key,
      new Response("ok", {
        headers: { "Cache-Control": `max-age=${healthCheckCacheSeconds}` },
      })
    )
  }
  return "ok"
}

export async function createHealthResponse(
  environment: string,
  { cache, database, files, realtime, version }: HealthDependencies
): Promise<Response> {
  const [databaseStatus, filesStatus, realtimeStatus] = await Promise.all([
    cachedCheck(
      "database",
      () => database.prepare("SELECT 1 AS healthy").first(),
      cache
    ),
    files
      ? cachedCheck("files", () => files.head("health/probe"), cache)
      : Promise.resolve("disabled" as const),
    realtime
      ? cachedCheck("realtime", () => realtime.connections(), cache)
      : Promise.resolve("disabled" as const),
  ])
  const healthy =
    databaseStatus === "ok" &&
    filesStatus !== "error" &&
    realtimeStatus !== "error"

  return Response.json(
    {
      status: healthy ? "ok" : "error",
      service: "tanbase-core",
      environment: normalizeAppEnvironment(environment),
      version: version ?? null,
      checks: {
        database: databaseStatus,
        files: filesStatus,
        realtime: realtimeStatus,
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
