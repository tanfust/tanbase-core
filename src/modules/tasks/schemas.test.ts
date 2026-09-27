import { describe, expect, it } from "vitest"

import {
  createProjectInputSchema,
  createTaskInputSchema,
  dateFromDueAt,
  taskFormSchema,
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

  it("converts the task dialog's fields into the values the server takes", () => {
    const values = taskFormSchema.parse({
      title: "  Ship  ",
      notes: "   ",
      status: "doing",
      dueAt: "2026-10-05",
    })
    expect(values).toMatchObject({
      title: "Ship",
      notes: null,
      status: "doing",
    })
    expect(dateFromDueAt(values.dueAt)).toBe("2026-10-05")
    expect(
      createTaskInputSchema.parse({ ...values, projectId: "project" })
    ).toMatchObject(values)
    expect(
      taskFormSchema.parse({
        title: "Ship",
        notes: "",
        status: "todo",
        dueAt: "",
      }).dueAt
    ).toBeNull()
  })

  it("reports the dialog's errors on the fields that hold them", () => {
    const result = taskFormSchema.safeParse({
      title: "   ",
      notes: "x".repeat(10_001),
      status: "todo",
      dueAt: "",
    })
    expect(
      result.error?.issues.map((issue) => [issue.path, issue.message])
    ).toEqual([
      [["title"], "Enter a task title."],
      [["notes"], "Use at most 10,000 characters for the notes."],
    ])
    expect(
      createProjectInputSchema.safeParse({ name: " " }).error?.issues[0]
        ?.message
    ).toBe("Enter a project name.")
  })
})
