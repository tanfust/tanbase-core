import { z } from "zod"

import { siteConfig } from "@/lib/site"
import { taskStatuses } from "@/modules/tasks/contracts"

// Neither the Worker nor the page CSP allows eval, so zod's JIT never runs.
// Opting out before the first object schema also skips zod's eval probe,
// which the browser would report as a CSP violation. zod declares itself
// side-effect free, so client builds drop its default English messages;
// set them here so browser tools report readable errors.
z.config({ jitless: true, ...z.locales.en() })

/**
 * The task tools, defined once for the `/mcp` server, the browser's WebMCP
 * tools, and the published server card.
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
  name: "list_tasks",
  title: "List tasks",
  description:
    "List the user's tasks across projects, optionally filtered by project, status, or due date. Returns each task's ID, title, notes, status, due date, and project.",
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
  name: "create_task",
  title: "Create a task",
  description:
    "Create a task on the user's board. Without a projectId it goes to the user's first project. The task appears live on every open board.",
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
  name: "complete_task",
  title: "Complete a task",
  description:
    "Mark one of the user's tasks as done by its ID, as returned by list_tasks.",
  inputSchema: z.object({ taskId: z.string().min(1) }),
  outputSchema: taskOutput,
  annotations: {
    readOnlyHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const

export const taskTools = [listTasksTool, createTaskTool, completeTaskTool]

/**
 * A browser tool's result: the value, or a message the agent can act on.
 * Messages survive the RPC boundary, unlike thrown errors.
 */
export type BrowserToolResult<T> =
  { ok: true; value: T } | { ok: false; error: string }
