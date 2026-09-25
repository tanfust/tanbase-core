import { useEffect, useState } from "react"

import { TaskAttachments } from "@/components/board/task-attachments"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { TaskStatus, TaskView } from "@/modules/tasks/contracts"

interface TaskValues {
  title: string
  notes: string | null
  status: TaskStatus
  dueAt: number | null
}

function dateValue(timestamp: number | null) {
  if (!timestamp) return ""
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function TaskDialog({
  open,
  onOpenChange,
  status = "todo",
  task,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  status?: TaskStatus
  task?: TaskView | null
  pending: boolean
  onSubmit: (values: TaskValues) => Promise<void>
}) {
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(status)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedStatus(task?.status ?? status)
      setError(null)
    }
  }, [open, status, task])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get("title") ?? "").trim()
    if (!title) {
      setError("Enter a task title.")
      return
    }
    const rawDueAt = String(form.get("dueAt") ?? "")
    await onSubmit({
      title,
      notes: String(form.get("notes") ?? "").trim() || null,
      status: selectedStatus,
      dueAt: rawDueAt ? new Date(`${rawDueAt}T12:00:00`).getTime() : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription>
            Keep the next action clear. Notes and a due date are optional.
          </DialogDescription>
        </DialogHeader>
        <form
          key={task?.id ?? `new:${status}`}
          method="post"
          onSubmit={submit}
          className="flex flex-col gap-6"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="task-title">Title</FieldLabel>
              <Input
                id="task-title"
                name="title"
                defaultValue={task?.title}
                maxLength={200}
                autoFocus
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="task-notes">Notes</FieldLabel>
              <Textarea
                id="task-notes"
                name="notes"
                defaultValue={task?.notes ?? ""}
                maxLength={10_000}
                rows={4}
              />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={selectedStatus}
                onValueChange={(value) => value && setSelectedStatus(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="todo">Todo</SelectItem>
                    <SelectItem value="doing">Doing</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="task-due-at">Due date</FieldLabel>
              <Input
                id="task-due-at"
                name="dueAt"
                type="date"
                defaultValue={dateValue(task?.dueAt ?? null)}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          {/* Attachments save immediately and need an existing task. */}
          {task && <TaskAttachments taskId={task.id} />}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {pending ? "Saving…" : task ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
