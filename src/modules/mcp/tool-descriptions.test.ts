import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  completeTaskDescription,
  createTaskDescription,
  listTasksDescription,
} from "./tool-descriptions"
import {
  completeTaskTool,
  createTaskTool,
  listTasksTool,
  parseToolInput,
} from "./tool-definitions"

const tools = [
  {
    name: "list_tasks",
    description: listTasksDescription,
    definition: listTasksTool,
  },
  {
    name: "create_task",
    description: createTaskDescription,
    definition: createTaskTool,
  },
  {
    name: "complete_task",
    description: completeTaskDescription,
    definition: completeTaskTool,
  },
]

describe("the browser's tool descriptions", () => {
  it.each(tools)(
    "describe $name as Zod generates it",
    ({ description, definition }) => {
      expect(description.inputJsonSchema).toEqual(
        z.toJSONSchema(definition.inputSchema, { io: "input" })
      )
      expect(definition).toMatchObject({
        name: description.name,
        title: description.title,
        description: description.description,
      })
    }
  )
})

describe("parseToolInput", () => {
  it("returns the parsed input", () => {
    expect(
      parseToolInput(createTaskTool.inputSchema, { title: " Plan " })
    ).toEqual({ ok: true, value: { title: "Plan" } })
  })

  it("returns Zod's message for invalid input", () => {
    const result = parseToolInput(listTasksTool.inputSchema, { limit: 500 })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/limit/)
  })

  it("treats missing input as an empty object", () => {
    expect(parseToolInput(listTasksTool.inputSchema, undefined)).toEqual({
      ok: true,
      value: {},
    })
    const result = parseToolInput(completeTaskTool.inputSchema, undefined)
    expect(!result.ok && result.error).toMatch(/taskId/)
  })
})
