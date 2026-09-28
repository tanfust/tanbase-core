import {
  completeTaskInBrowser,
  createTaskInBrowser,
  listTasksInBrowser,
} from "./browser-tools"
import {
  completeTaskDescription,
  createTaskDescription,
  listTasksDescription,
} from "./tool-descriptions"
import type { ModelContext, WebMcpTool } from "./model-context"
import type { BrowserToolResult } from "./tool-descriptions"

interface Description {
  name: string
  title: string
  description: string
  inputJsonSchema: Record<string, unknown>
}

// The server functions validate each call with the tool's Zod schema and
// return a readable message, so this module, which every page with WebMCP
// loads, carries no Zod.
function browserTool<T>(
  definition: Description,
  call: (input: unknown) => Promise<BrowserToolResult<T>>,
  annotations: WebMcpTool["annotations"] = {}
): WebMcpTool {
  return {
    name: definition.name,
    title: definition.title,
    description: `${definition.description} Acts as the person signed in to this tab.`,
    inputSchema: definition.inputJsonSchema,
    annotations,
    async execute(input) {
      const result = await call(input ?? {})
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
  }
}

export function taskWebMcpTools(): WebMcpTool[] {
  return [
    browserTool(
      listTasksDescription,
      (data) => listTasksInBrowser({ data }),
      // Titles and notes are free text, some written by AI breakdowns.
      { readOnlyHint: true, untrustedContentHint: true }
    ),
    browserTool(createTaskDescription, (data) => createTaskInBrowser({ data })),
    browserTool(completeTaskDescription, (data) =>
      completeTaskInBrowser({ data })
    ),
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
