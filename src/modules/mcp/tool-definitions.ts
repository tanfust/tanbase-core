import { z } from "zod"

import { siteConfig } from "@/lib/site"
import { taskStatuses } from "@/modules/tasks/contracts"

import {
  completeTaskDescription,
  createTaskDescription,
  listTasksDescription,
} from "./tool-descriptions"
import type { BrowserToolResult } from "./tool-descriptions"

// The Worker does not allow eval, so zod's JIT never runs; opting out before
// the first object schema also skips zod's eval probe. zod declares itself
// side-effect free, so set its English messages here too, for the errors
// the tools return.
z.config({ jitless: true, ...z.locales.en() })

/**
 * The task tools, defined once for the `/mcp` server, the browser's WebMCP
 * tools, and the published server card. Their names, descriptions, and
 * JSON Schemas live in tool-descriptions.ts, which the browser loads; the
 * Zod schemas here stay on the Worker.
 */
export const mcpServerInfo = {
  name: siteConfig.id,
  title: `${siteConfig.name} tasks`,
  version: "1.0.0",
}

export const mcpInstructions = `Tools for the signed-in user's ${siteConfig.name} task board. Dates are calendar days in YYYY-MM-DD form.`

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")

export const taskOutput = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().nullable(),
  status: z.enum(taskStatuses),
  parentId: z.string().nullable(),
  dueDate: z.string().nullable(),
  project: z.object({ id: z.string(), name: z.string() }),
})

export const listTasksTool = {
  name: listTasksDescription.name,
  title: listTasksDescription.title,
  description: listTasksDescription.description,
  inputSchema: z.object({
    projectId: z.string().min(1).optional(),
    status: z.enum(taskStatuses).optional(),
    dueBefore: calendarDate
      .optional()
      .describe("Only tasks due on or before this date."),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  outputSchema: z.object({ tasks: z.array(taskOutput) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
} as const

export const createTaskTool = {
  name: createTaskDescription.name,
  title: createTaskDescription.title,
  description: createTaskDescription.description,
  inputSchema: z.object({
    title: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(10_000).optional(),
    projectId: z.string().min(1).optional(),
    status: z.enum(taskStatuses).optional(),
    dueDate: calendarDate.optional(),
  }),
  outputSchema: taskOutput,
  annotations: { readOnlyHint: false, openWorldHint: false },
} as const

export const completeTaskTool = {
  name: completeTaskDescription.name,
  title: completeTaskDescription.title,
  description: completeTaskDescription.description,
  inputSchema: z.object({ taskId: z.string().min(1) }),
  outputSchema: taskOutput,
  annotations: {
    readOnlyHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const

export const taskTools = [listTasksTool, createTaskTool, completeTaskTool]

export type { BrowserToolResult } from "./tool-descriptions"

/**
 * An agent's input checked against a tool's schema, or Zod's message for it.
 * The browser sends WebMCP input unchecked, so its server functions call this.
 */
export function parseToolInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown
): BrowserToolResult<z.output<TSchema>> {
  const parsed = schema.safeParse(input ?? {})
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: z.prettifyError(parsed.error) }
}
