import { taskStatuses } from "@/modules/tasks/contracts"

// Kept free of Zod, because the browser's WebMCP tools load this module.
// tool-definitions.ts adds the Zod schemas that the server validates every
// call with, and a test keeps each `inputJsonSchema` below equal to what Zod
// generates from the matching input schema.

const jsonSchemaDialect = "https://json-schema.org/draft/2020-12/schema"

const calendarDate = {
  type: "string",
  pattern: String.raw`^\d{4}-\d{2}-\d{2}$`,
} as const

const status = { type: "string", enum: [...taskStatuses] } as const

const id = { type: "string", minLength: 1 } as const

export const listTasksDescription = {
  name: "list_tasks",
  title: "List tasks",
  description:
    "List the user's tasks across projects, optionally filtered by project, status, or due date. Returns each task's ID, title, notes, status, due date, and project.",
  inputJsonSchema: {
    $schema: jsonSchemaDialect,
    type: "object",
    properties: {
      projectId: id,
      status,
      dueBefore: {
        description: "Only tasks due on or before this date.",
        ...calendarDate,
      },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
} as const

export const createTaskDescription = {
  name: "create_task",
  title: "Create a task",
  description:
    "Create a task on the user's board. Without a projectId it goes to the user's first project. The task appears live on every open board.",
  inputJsonSchema: {
    $schema: jsonSchemaDialect,
    type: "object",
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      notes: { type: "string", maxLength: 10_000 },
      projectId: id,
      status,
      dueDate: calendarDate,
    },
    required: ["title"],
  },
} as const

export const completeTaskDescription = {
  name: "complete_task",
  title: "Complete a task",
  description:
    "Mark one of the user's tasks as done by its ID, as returned by list_tasks.",
  inputJsonSchema: {
    $schema: jsonSchemaDialect,
    type: "object",
    properties: { taskId: id },
    required: ["taskId"],
  },
} as const

/**
 * A browser tool's result: the value, or a message the agent can act on.
 * Messages survive the RPC boundary, unlike thrown errors.
 */
export type BrowserToolResult<T> =
  { ok: true; value: T } | { ok: false; error: string }
