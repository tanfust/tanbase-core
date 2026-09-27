import { TaskAttachments } from "@/components/board/task-attachments"
import { submitHandler, useAppForm, validateOnSubmit } from "@/components/form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TaskStatus, TaskView } from "@/modules/tasks/contracts"
import { dateFromDueAt, taskFormSchema } from "@/modules/tasks/schemas"
import type { TaskValues } from "@/modules/tasks/schemas"

export function TaskDialog({
  open,
  onOpenChange,
  status = "todo",
  task,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  status?: TaskStatus
  task?: TaskView | null
  /** Saves the task; it reports its own failures, so a rejection is ignored. */
  onSubmit: (values: TaskValues) => Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription>
            Keep the next action clear. Notes and a due date are optional.
          </DialogDescription>
        </DialogHeader>
        {/* The dialog unmounts its content when closed, so each opening
            starts a form from the task's current values. */}
        <TaskForm
          key={task?.id ?? `new:${status}`}
          status={status}
          task={task ?? null}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  )
}

function TaskForm({
  status,
  task,
  onCancel,
  onSubmit,
}: {
  status: TaskStatus
  task: TaskView | null
  onCancel: () => void
  onSubmit: (values: TaskValues) => Promise<void>
}) {
  const form = useAppForm({
    defaultValues: {
      title: task?.title ?? "",
      notes: task?.notes ?? "",
      status: task?.status ?? status,
      dueAt: dateFromDueAt(task?.dueAt ?? null),
    },
    validationLogic: validateOnSubmit,
    validators: { onDynamic: taskFormSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(taskFormSchema.parse(value)).catch(() => undefined)
    },
  })

  return (
    <form
      method="post"
      onSubmit={submitHandler(form)}
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        <form.AppField name="title">
          {(field) => (
            <field.TextField
              id="task-title"
              label="Title"
              maxLength={200}
              autoFocus
              required
            />
          )}
        </form.AppField>
        <form.AppField name="notes">
          {(field) => (
            <field.TextareaField
              id="task-notes"
              label="Notes"
              maxLength={10_000}
              rows={4}
            />
          )}
        </form.AppField>
        <form.Field name="status">
          {(field) => (
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                name={field.name}
                value={field.state.value}
                onValueChange={(value) => value && field.handleChange(value)}
              >
                <SelectTrigger className="w-full" onBlur={field.handleBlur}>
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
          )}
        </form.Field>
        <form.AppField name="dueAt">
          {(field) => (
            <field.TextField id="task-due-at" label="Due date" type="date" />
          )}
        </form.AppField>
      </FieldGroup>
      {/* Attachments save immediately and need an existing task. */}
      {task && <TaskAttachments taskId={task.id} />}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <form.AppForm>
          <form.SubmitButton pendingLabel="Saving…">
            {task ? "Save changes" : "Create task"}
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
  )
}
