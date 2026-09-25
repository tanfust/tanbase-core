export const appEnvironments = ["local", "production"] as const

export type AppEnvironment = (typeof appEnvironments)[number]

export function normalizeAppEnvironment(value: string): AppEnvironment {
  return appEnvironments.includes(value as AppEnvironment)
    ? (value as AppEnvironment)
    : "local"
}

// A successful database check is reused for this long in each Cloudflare
// location, so a public health endpoint cannot turn into unbounded D1 load.
export const databaseCheckCacheSeconds = 30

interface HealthCache {
  cache: Cache
  /** Absolute URL identifying the cached check, on the serving origin. */
  key: string
}

async function checkDatabase(
  database: D1Database,
  cached?: HealthCache
): Promise<"ok" | "error"> {
  if (cached && (await cached.cache.match(cached.key))) return "ok"

  try {
    await database.prepare("SELECT 1 AS healthy").first()
  } catch {
    // Failures are never cached, so recovery is visible on the next request.
    return "error"
  }

  await cached?.cache.put(
    cached.key,
    new Response("ok", {
      headers: { "Cache-Control": `max-age=${databaseCheckCacheSeconds}` },
    })
  )
  return "ok"
}

export async function createHealthResponse(
  environment: string,
  database: D1Database,
  cached?: HealthCache
): Promise<Response> {
  const status = await checkDatabase(database, cached)
  return status === "ok"
    ? healthResponse(environment, "ok", 200)
    : healthResponse(environment, "error", 503)
}

function healthResponse(
  environment: string,
  database: "ok" | "error",
  status: 200 | 503
): Response {
  return Response.json(
    {
      status: database === "ok" ? "ok" : "error",
      service: "tanbase-core",
      environment: normalizeAppEnvironment(environment),
      checks: { database },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
