import { env } from "cloudflare:workers"

export type AppEnvironment = "local" | "production"

/**
 * The environment this Worker runs as. The top level of wrangler.jsonc sets
 * no APP_ENV, since the Deploy to Cloudflare button would ask for it
 * (ADR-0022), so a Worker without one runs as production; `env.local` sets
 * "local".
 */
export function appEnvironment(
  value: string | undefined = env.APP_ENV
): AppEnvironment {
  return value === "local" ? "local" : "production"
}
