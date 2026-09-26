import { getRequestHeaders } from "@tanstack/react-start/server"
import type { z } from "zod"

import { getSessionFromHeaders } from "@/modules/auth/session.server"

import type {
  BrowserToolResult,
  completeTaskTool,
  createTaskTool,
  listTasksTool,
} from "./tool-definitions"
import {
  completeTask,
  createTaskForUser,
  listTasks,
  McpToolError,
} from "./tools.server"
import type { McpTask } from "./tools.server"

export const signedOutMessage =
  "The person is not signed in to TanBase Core. Ask them to sign in at /login, then try again."

async function run<T>(
  work: (userId: string) => Promise<T>
): Promise<BrowserToolResult<T>> {
  const session = await getSessionFromHeaders(getRequestHeaders())
  if (!session) return { ok: false, error: signedOutMessage }
  try {
    return { ok: true, value: await work(session.user.id) }
  } catch (error) {
    if (error instanceof McpToolError)
      return { ok: false, error: error.message }
    throw error
  }
}

export function listTasksImpl(
  input: z.output<typeof listTasksTool.inputSchema>
): Promise<BrowserToolResult<{ tasks: McpTask[] }>> {
  return run((userId) => listTasks(userId, input))
}

export function createTaskImpl(
  input: z.output<typeof createTaskTool.inputSchema>
): Promise<BrowserToolResult<McpTask>> {
  return run((userId) => createTaskForUser(userId, input))
}

export function completeTaskImpl(
  input: z.output<typeof completeTaskTool.inputSchema>
): Promise<BrowserToolResult<McpTask>> {
  return run((userId) => completeTask(userId, input.taskId))
}
