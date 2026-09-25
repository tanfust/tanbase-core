import { createServerFn } from "@tanstack/react-start"

export const getAuthChallengeConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const { readAuthChallengeConfig } = await import("./challenge.server")
    return readAuthChallengeConfig()
  }
)
