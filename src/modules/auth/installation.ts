/**
 * What keeps a deployment from signing anyone in: a database without its
 * tables, or no usable secret. A copy deployed with `npx wrangler deploy`
 * instead of `pnpm run deploy` has both (ADR-0021).
 */
export type InstallationProblem = "database" | "secret"

/**
 * `BETTER_AUTH_URL` names another origin than the page's. Better Auth
 * trusts only its own origin, so signing in on this one fails (ADR-0022).
 */
export interface OriginMismatch {
  configured: string
  current: string
}
