import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { TaskView } from "@/modules/tasks/contracts"
import { dateFromDueAt } from "@/modules/tasks/schemas"

import { TaskDialog } from "./task-dialog"

// Attachments load over the network and only show for an existing task.
vi.mock("@/components/board/task-attachments", () => ({
  TaskAttachments: () => null,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function submit(name: RegExp) {
  const button = screen.getByRole("button", { name })
  fireEvent.submit(button.closest("form")!)
}

describe("TaskDialog", () => {
  it("shows the schema's error on the title and does not submit", async () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    render(
      <TaskDialog open onOpenChange={() => undefined} onSubmit={onSubmit} />
    )

    const title = screen.getByLabelText("Title")
    fireEvent.change(title, { target: { value: "   " } })
    submit(/create task/i)

    const error = await screen.findByText("Enter a task title.")
    expect(error.getAttribute("role")).toBe("alert")
    expect(title.getAttribute("aria-invalid")).toBe("true")
    expect(title.getAttribute("aria-describedby")).toBe(error.id)
    expect(onSubmit).not.toHaveBeenCalled()

    // After the first submit, the field revalidates as it changes.
    fireEvent.change(title, { target: { value: "Ship it" } })
    await waitFor(() =>
      expect(screen.queryByText("Enter a task title.")).toBeNull()
    )
    expect(title.getAttribute("aria-invalid")).toBeNull()
  })

  it("submits the values the server functions validate", async () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    render(
      <TaskDialog
        open
        onOpenChange={() => undefined}
        status="doing"
        onSubmit={onSubmit}
      />
    )

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Write the post  " },
    })
    fireEvent.change(screen.getByLabelText("Due date"), {
      target: { value: "2026-10-05" },
    })
    submit(/create task/i)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const [values] = onSubmit.mock.calls[0] as unknown as [
      { title: string; notes: string | null; status: string; dueAt: number },
    ]
    expect(values).toMatchObject({
      title: "Write the post",
      notes: null,
      status: "doing",
    })
    expect(dateFromDueAt(values.dueAt)).toBe("2026-10-05")
  })

  it("starts from the task being edited", async () => {
    const task: TaskView = {
      id: "task-1",
      projectId: "project-1",
      parentId: null,
      title: "Existing",
      notes: "Keep this",
      status: "done",
      position: 0,
      dueAt: new Date("2026-10-01T12:00:00").getTime(),
      createdAt: 0,
      updatedAt: 0,
    }
    const onSubmit = vi.fn(() => Promise.resolve())
    render(
      <TaskDialog
        open
        onOpenChange={() => undefined}
        task={task}
        onSubmit={onSubmit}
      />
    )

    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe(
      "Existing"
    )
    expect(screen.getByLabelText<HTMLInputElement>("Due date").value).toBe(
      "2026-10-01"
    )
    submit(/save changes/i)
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ notes: "Keep this", status: "done" })
      )
    )
  })

  it("ignores a failed save, which the board reports itself", async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error("offline")))
    render(
      <TaskDialog open onOpenChange={() => undefined} onSubmit={onSubmit} />
    )
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Ship it" },
    })
    submit(/create task/i)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: /create task/i })
          .disabled
      ).toBe(false)
    )
  })
})
