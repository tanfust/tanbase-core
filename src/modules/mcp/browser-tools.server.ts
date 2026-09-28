import { getRequestHeaders } from "@tanstack/react-start/server"
import type { z } from "zod"

import { siteConfig } from "@/lib/site"
import { getSessionFromHeaders } from "@/modules/auth/session.server"

import type { BrowserToolResult } from "./tool-definitions"
import {
  completeTaskTool,
  createTaskTool,
  listTasksTool,
  parseToolInput,
} from "./tool-definitions"
import {
  completeTask,
  createTaskForUser,
  listTasks,
  McpToolError,
} from "./tools.server"
import type { McpTask } from "./tools.server"

export const signedOutMessage = `The person is not signed in to ${siteConfig.name}. Ask them to sign in at /login, then try again.`

async function run<TSchema extends z.ZodType, T>(
  schema: TSchema,
  input: unknown,
  work: (userId: string, input: z.output<TSchema>) => Promise<T>
): Promise<BrowserToolResult<T>> {
  // The page sends the agent's input unchecked; see browser-tools.ts.
  const parsed = parseToolInput(schema, input)
  if (!parsed.ok) return parsed
  const session = await getSessionFromHeaders(getRequestHeaders())
  if (!session) return { ok: false, error: signedOutMessage }
  try {
    return { ok: true, value: await work(session.user.id, parsed.value) }
  } catch (error) {
    if (error instanceof McpToolError)
      return { ok: false, error: error.message }
    throw error
  }
}

export function listTasksImpl(
  input: unknown
): Promise<BrowserToolResult<{ tasks: McpTask[] }>> {
  return run(listTasksTool.inputSchema, input, (userId, data) =>
    listTasks(userId, data)
  )
}

export function createTaskImpl(
  input: unknown
): Promise<BrowserToolResult<McpTask>> {
  return run(createTaskTool.inputSchema, input, (userId, data) =>
    createTaskForUser(userId, data)
  )
}

export function completeTaskImpl(
  input: unknown
): Promise<BrowserToolResult<McpTask>> {
  return run(completeTaskTool.inputSchema, input, (userId, data) =>
    completeTask(userId, data.taskId)
  )
}
