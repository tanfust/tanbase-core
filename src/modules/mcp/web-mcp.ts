import { z } from "zod"

import {
  completeTaskInBrowser,
  createTaskInBrowser,
  listTasksInBrowser,
} from "./browser-tools"
import {
  completeTaskTool,
  createTaskTool,
  listTasksTool,
} from "./tool-definitions"
import type { ModelContext, WebMcpTool } from "./model-context"
import type { BrowserToolResult } from "./tool-definitions"

interface Definition<TSchema extends z.ZodType> {
  name: string
  title: string
  description: string
  inputSchema: TSchema
}

function browserTool<TSchema extends z.ZodType, T>(
  definition: Definition<TSchema>,
  call: (input: z.output<TSchema>) => Promise<BrowserToolResult<T>>,
  annotations: WebMcpTool["annotations"] = {}
): WebMcpTool {
  return {
    name: definition.name,
    title: definition.title,
    description: `${definition.description} Acts as the person signed in to this tab.`,
    inputSchema: z.toJSONSchema(definition.inputSchema, { io: "input" }),
    annotations,
    async execute(input) {
      const parsed = definition.inputSchema.safeParse(input ?? {})
      if (!parsed.success) throw new Error(z.prettifyError(parsed.error))
      const result = await call(parsed.data)
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
  }
}

export function taskWebMcpTools(): WebMcpTool[] {
  return [
    browserTool(
      listTasksTool,
      (data) => listTasksInBrowser({ data }),
      // Titles and notes are free text, some written by AI breakdowns.
      { readOnlyHint: true, untrustedContentHint: true }
    ),
    browserTool(createTaskTool, (data) => createTaskInBrowser({ data })),
    browserTool(completeTaskTool, (data) => completeTaskInBrowser({ data })),
  ]
}

/** Registers the task tools until `signal` aborts. */
export function registerTaskTools(
  modelContext: ModelContext,
  signal: AbortSignal
): void {
  for (const tool of taskWebMcpTools()) {
    try {
      const registration = modelContext.registerTool(tool, { signal })
      // Current builds return a promise; early ones returned a handle to
      // unregister instead of honoring the signal.
      if (registration instanceof Promise) {
        registration.catch(() => undefined)
      } else if (
        typeof (registration as { unregister?: unknown } | undefined)
          ?.unregister === "function"
      ) {
        const handle = registration as { unregister: () => void }
        signal.addEventListener("abort", () => handle.unregister(), {
          once: true,
        })
      }
    } catch {
      // A rejected registration leaves the page itself working.
    }
  }
}
