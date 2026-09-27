import { createServerFn } from "@tanstack/react-start"

/**
 * The deployment's public origin for canonical URLs and structured data:
 * the configured `BETTER_AUTH_URL`, or the origin the visitor arrived on.
 */
export const getSiteOrigin = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requirePublicOrigin } = await import("@/platform/origin")
    return { origin: requirePublicOrigin() }
  }
)
