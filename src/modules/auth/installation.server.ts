import type { InstallationProblem } from "./installation"
import { hasAuthTables } from "./repository.server"

/** The shortest BETTER_AUTH_SECRET the Worker accepts. */
export const minimumAuthSecretLength = 32

export function authSecretUsable(secret: string | undefined): boolean {
  return typeof secret === "string" && secret.length >= minimumAuthSecretLength
}

// Databases known to have their tables, per isolate. Only a positive answer
// is kept, so an installation fixed without a redeploy recovers.
const readyDatabases = new WeakSet<D1Database>()

/**
 * The first problem to fix, or null. The database comes first, since
 * `pnpm run deploy` fixes both. A failed check proves nothing, so it does
 * not count as a problem.
 */
export async function findInstallationProblem(environment: {
  BETTER_AUTH_SECRET?: string
  DB: D1Database
}): Promise<InstallationProblem | null> {
  if (!readyDatabases.has(environment.DB)) {
    try {
      if (!(await hasAuthTables(environment.DB))) return "database"
      readyDatabases.add(environment.DB)
    } catch {
      // Sign-in reports its own error.
    }
  }
  return authSecretUsable(environment.BETTER_AUTH_SECRET) ? null : "secret"
}
