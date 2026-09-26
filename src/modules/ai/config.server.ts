import { env } from "cloudflare:workers"

import type { BreakdownParams } from "./contracts"

export interface AiConfig {
  ai: Ai
  model: string
  gatewayId: string
  dailyLimit: number
}

interface AiEnvironment {
  AI?: Ai
  AI_MODEL?: string
  AI_GATEWAY_ID?: string
  AI_DAILY_LIMIT?: string
}

/**
 * The Workers AI configuration, or null when this environment has no AI
 * binding, model, gateway, or positive quota. Local development has no AI
 * binding by default, so AI features report themselves as unavailable.
 */
export function readAiConfig(
  environment: AiEnvironment = env
): AiConfig | null {
  const dailyLimit = Number(environment.AI_DAILY_LIMIT ?? 0)
  if (
    !environment.AI ||
    !environment.AI_MODEL ||
    !environment.AI_GATEWAY_ID ||
    !Number.isInteger(dailyLimit) ||
    dailyLimit <= 0
  ) {
    return null
  }

  return {
    ai: environment.AI,
    model: environment.AI_MODEL,
    gatewayId: environment.AI_GATEWAY_ID,
    dailyLimit,
  }
}

export function getAiLimiter(): RateLimit | null {
  return (env as { AI_LIMITER?: RateLimit }).AI_LIMITER ?? null
}

export function getBreakdownWorkflow(): Workflow<BreakdownParams> | null {
  return (env as { BREAKDOWN?: Workflow<BreakdownParams> }).BREAKDOWN ?? null
}

/** Quotas reset at midnight UTC. */
export function usageDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}
