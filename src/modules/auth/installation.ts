/**
 * What keeps a deployment from signing anyone in: a database without its
 * tables, or no usable secret. A copy deployed with `npx wrangler deploy`
 * instead of `pnpm run deploy` has both (ADR-0021).
 */
export type InstallationProblem = "database" | "secret"
