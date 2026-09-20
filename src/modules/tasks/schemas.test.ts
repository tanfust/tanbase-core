import { describe, expect, it } from "vitest"

import {
  createProjectInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
} from "./schemas"

describe("task input schemas", () => {
  it("trims valid project and task text", () => {
    expect(createProjectInputSchema.parse({ name: "  Launch  " })).toEqual({
      name: "Launch",
    })
    expect(
      createTaskInputSchema.parse({ projectId: "project", title: "  Ship  " })
    ).toMatchObject({ title: "Ship", notes: null, status: "todo", dueAt: null })
  })

  it("rejects invalid lengths, statuses, and due dates", () => {
    expect(() => createProjectInputSchema.parse({ name: "" })).toThrow()
    expect(() =>
      createTaskInputSchema.parse({
        projectId: "project",
        title: "x".repeat(201),
      })
    ).toThrow()
    expect(() =>
      updateTaskInputSchema.parse({ taskId: "task", status: "blocked" })
    ).toThrow()
    expect(() =>
      updateTaskInputSchema.parse({ taskId: "task", dueAt: -1 })
    ).toThrow()
  })
})
