import { createServerFn } from "@tanstack/react-start"

/**
 * The MCP task tools for WebMCP in the person's own browser tab. They act as
 * the signed-in session instead of an OAuth token, through the same tool
 * implementations as `/mcp`.
 *
 * Each takes the agent's input as it came: the handler validates it with the
 * tool's Zod schema on the Worker and returns any problem as a message, so
 * the page loads no Zod.
 */
function asToolInput(input: unknown): unknown {
  return input
}

export const listTasksInBrowser = createServerFn({ method: "GET" })
  .validator(asToolInput)
  .handler(async ({ data }) => {
    const { listTasksImpl } = await import("./browser-tools.server")
    return listTasksImpl(data)
  })

export const createTaskInBrowser = createServerFn({ method: "POST" })
  .validator(asToolInput)
  .handler(async ({ data }) => {
    const { createTaskImpl } = await import("./browser-tools.server")
    return createTaskImpl(data)
  })

export const completeTaskInBrowser = createServerFn({ method: "POST" })
  .validator(asToolInput)
  .handler(async ({ data }) => {
    const { completeTaskImpl } = await import("./browser-tools.server")
    return completeTaskImpl(data)
  })
