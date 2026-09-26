import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

const startBreakdownInputSchema = z.object({ taskId: z.string().min(1) })
const breakdownStatusInputSchema = z.object({
  instanceId: z.string().min(1).max(100),
})

export const getAiStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getAiStatusImpl } = await import("./functions.server")
    return getAiStatusImpl()
  }
)

export const startTaskBreakdown = createServerFn({ method: "POST" })
  .validator(startBreakdownInputSchema)
  .handler(async ({ data }) => {
    const { startTaskBreakdownImpl } = await import("./functions.server")
    return startTaskBreakdownImpl(data)
  })

export const getTaskBreakdown = createServerFn({ method: "GET" })
  .validator(breakdownStatusInputSchema)
  .handler(async ({ data }) => {
    const { getTaskBreakdownImpl } = await import("./functions.server")
    return getTaskBreakdownImpl(data)
  })
