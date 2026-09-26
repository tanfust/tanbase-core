import { createServerFn } from "@tanstack/react-start"

import {
  completeTaskTool,
  createTaskTool,
  listTasksTool,
} from "./tool-definitions"

/**
 * The MCP task tools for WebMCP in the person's own browser tab. They act as
 * the signed-in session instead of an OAuth token, through the same tool
 * implementations as `/mcp`.
 */
export const listTasksInBrowser = createServerFn({ method: "GET" })
  .validator(listTasksTool.inputSchema)
  .handler(async ({ data }) => {
    const { listTasksImpl } = await import("./browser-tools.server")
    return listTasksImpl(data)
  })

export const createTaskInBrowser = createServerFn({ method: "POST" })
  .validator(createTaskTool.inputSchema)
  .handler(async ({ data }) => {
    const { createTaskImpl } = await import("./browser-tools.server")
    return createTaskImpl(data)
  })

export const completeTaskInBrowser = createServerFn({ method: "POST" })
  .validator(completeTaskTool.inputSchema)
  .handler(async ({ data }) => {
    const { completeTaskImpl } = await import("./browser-tools.server")
    return completeTaskImpl(data)
  })
