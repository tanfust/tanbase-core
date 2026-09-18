export const appEnvironments = ["local", "preview", "production"] as const

export type AppEnvironment = (typeof appEnvironments)[number]

export function normalizeAppEnvironment(value: string): AppEnvironment {
  return appEnvironments.includes(value as AppEnvironment)
    ? (value as AppEnvironment)
    : "local"
}

export async function createHealthResponse(
  environment: string,
  database: D1Database
): Promise<Response> {
  try {
    await database.prepare("SELECT 1 AS healthy").first()

    return healthResponse(environment, "ok", 200)
  } catch {
    return healthResponse(environment, "error", 503)
  }
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
