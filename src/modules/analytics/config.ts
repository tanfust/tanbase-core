import { createServerFn } from "@tanstack/react-start"

export const getAnalyticsConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const [{ env }, { readAnalyticsConfig }] = await Promise.all([
      import("cloudflare:workers"),
      import("@/platform/analytics"),
    ])
    return readAnalyticsConfig(env)
  }
)
