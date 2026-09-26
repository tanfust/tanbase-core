// Kept free of dependencies: every page loads it, and only browsers with
// WebMCP go on to load the tools.

/** A WebMCP tool, as `modelContext.registerTool()` takes it. */
export interface WebMcpTool {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
  execute: (input: unknown) => Promise<unknown>
}

/** The part of the WebMCP `ModelContext` this page uses. */
export interface ModelContext {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal }
  ) => unknown
}

/**
 * The spec's `document.modelContext`, or the `navigator.modelContext` of
 * earlier drafts, which Chrome's first builds and scanners still use.
 */
export function findModelContext(
  scope: { document?: unknown; navigator?: unknown } = globalThis
): ModelContext | null {
  for (const host of [scope.document, scope.navigator]) {
    const candidate = (
      host as { modelContext?: Partial<ModelContext> } | undefined
    )?.modelContext
    if (typeof candidate?.registerTool === "function") {
      return candidate as ModelContext
    }
  }
  return null
}
