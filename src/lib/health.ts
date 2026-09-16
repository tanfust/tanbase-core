export const appEnvironments = ["local", "preview", "production"] as const

export type AppEnvironment = (typeof appEnvironments)[number]

export function normalizeAppEnvironment(value: string): AppEnvironment {
  return appEnvironments.includes(value as AppEnvironment)
    ? (value as AppEnvironment)
    : "local"
}

export function createHealthResponse(environment: string): Response {
  return Response.json(
    {
      status: "ok",
      service: "tanbase-core",
      environment: normalizeAppEnvironment(environment),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
