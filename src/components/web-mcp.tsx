import { useEffect } from "react"

import { findModelContext } from "@/modules/mcp/model-context"

/**
 * WebMCP: offers the MCP task tools to an agent working in this tab. Browsers
 * without `modelContext` skip it entirely.
 */
export function WebMcpTools() {
  useEffect(() => {
    const modelContext = findModelContext()
    if (!modelContext) return
    const controller = new AbortController()
    void import("@/modules/mcp/web-mcp").then(({ registerTaskTools }) => {
      if (!controller.signal.aborted) {
        registerTaskTools(modelContext, controller.signal)
      }
    })
    return () => controller.abort()
  }, [])

  return null
}
