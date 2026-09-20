import { useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { format } from "date-fns"
import {
  CalendarIcon,
  EllipsisIcon,
  FolderPlusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { TaskDialog } from "@/components/board/task-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import type {
  BoardSnapshot,
  TaskStatus,
  TaskView,
} from "@/modules/tasks/contracts"
import {
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  renameProject,
  updateTask,
} from "@/modules/tasks/functions"
import { boardQueryKey, boardQueryOptions } from "@/modules/tasks/queries"

const columns: Array<{
  status: TaskStatus
  title: string
  description: string
}> = [
  { status: "todo", title: "Todo", description: "Ready to start" },
  { status: "doing", title: "Doing", description: "In progress" },
  { status: "done", title: "Done", description: "Completed" },
]

type TaskValues = Pick<TaskView, "title" | "notes" | "status" | "dueAt">

export function BoardPage({ projectId }: { projectId?: string }) {
  const query = useSuspenseQuery(boardQueryOptions(projectId))
  const snapshot = query.data
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const key = boardQueryKey(projectId)
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean
    status: TaskStatus
    task: TaskView | null
  }>({
    open: false,
    status: "todo",
    task: null,
  })
  const [projectDialog, setProjectDialog] = useState<
    "create" | "rename" | null
  >(null)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<TaskView | null>(
    null
  )

  function updateCache(updater: (current: BoardSnapshot) => BoardSnapshot) {
    queryClient.setQueryData<BoardSnapshot>(key, (current) =>
      current ? updater(current) : current
    )
  }

  const createTaskMutation = useMutation({
    mutationFn: (values: TaskValues) =>
      createTask({
        data: { ...values, projectId: snapshot.activeProject!.id },
      }),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BoardSnapshot>(key)
      const tempId = `optimistic:${crypto.randomUUID()}`
      const now = Date.now()
      updateCache((current) => ({
        ...current,
        tasks: [
          ...current.tasks,
          {
            ...values,
            id: tempId,
            projectId: current.activeProject!.id,
            parentId: null,
            position: 0,
            createdAt: now,
            updatedAt: now,
          },
        ],
      }))
      return { previous, tempId }
    },
    onSuccess: (task, _values, context) => {
      updateCache((current) => ({
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === context.tempId ? task : item
        ),
      }))
      setTaskDialog((current) => ({ ...current, open: false }))
    },
    onError: (_error, _values, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.add({
        type: "error",
        title: "Task was not created",
        description: "Try again.",
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({
      taskId,
      values,
    }: {
      taskId: string
      values: Partial<TaskValues>
    }) => updateTask({ data: { taskId, ...values } }),
    onMutate: async ({ taskId, values }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BoardSnapshot>(key)
      updateCache((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? { ...task, ...values, updatedAt: Date.now() }
            : task
        ),
      }))
      return { previous }
    },
    onSuccess: (task) => {
      updateCache((current) => ({
        ...current,
        tasks: current.tasks.map((item) => (item.id === task.id ? task : item)),
      }))
      setTaskDialog((current) => ({ ...current, open: false }))
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.add({
        type: "error",
        title: "Task was not updated",
        description: "Your previous values were restored.",
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask({ data: { taskId } }),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BoardSnapshot>(key)
      updateCache((current) => ({
        ...current,
        tasks: current.tasks.filter((task) => task.id !== taskId),
      }))
      return { previous }
    },
    onSuccess: () => setDeleteTaskTarget(null),
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.add({
        type: "error",
        title: "Task was not deleted",
        description: "Try again.",
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const projectMutation = useMutation({
    mutationFn: async ({
      mode,
      name,
    }: {
      mode: "create" | "rename"
      name: string
    }) =>
      mode === "create"
        ? createProject({ data: { name } })
        : renameProject({
            data: { projectId: snapshot.activeProject!.id, name },
          }),
    onSuccess: async (project, variables) => {
      setProjectDialog(null)
      setProjectError(null)
      await queryClient.invalidateQueries({ queryKey: ["board"] })
      await router.invalidate()
      if (variables.mode === "create") {
        await navigate({ to: "/app", search: { project: project.id } })
      }
    },
    onError: () => setProjectError("The project could not be saved."),
  })

  const deleteProjectMutation = useMutation({
    mutationFn: () =>
      deleteProject({ data: { projectId: snapshot.activeProject!.id } }),
    onSuccess: async () => {
      const next = snapshot.projects.find(
        (project) => project.id !== snapshot.activeProject?.id
      )
      setDeleteProjectOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["board"] })
      await router.invalidate()
      await navigate({ to: "/app", search: next ? { project: next.id } : {} })
    },
    onError: () =>
      toast.add({
        type: "error",
        title: "Project was not deleted",
        description: "Try again.",
      }),
  })

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(
      new FormData(event.currentTarget).get("name") ?? ""
    ).trim()
    if (!name) {
      setProjectError("Enter a project name.")
      return
    }
    await projectMutation.mutateAsync({ mode: projectDialog!, name })
  }

  async function saveTask(values: TaskValues) {
    if (taskDialog.task) {
      await updateTaskMutation.mutateAsync({
        taskId: taskDialog.task.id,
        values,
      })
    } else {
      await createTaskMutation.mutateAsync(values)
    }
  }

  if (!snapshot.activeProject) {
    return (
      <Empty className="min-h-[60vh] border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderPlusIcon />
          </EmptyMedia>
          <EmptyTitle>Create your first project</EmptyTitle>
          <EmptyDescription>
            Projects keep related tasks together in one board.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setProjectDialog("create")}>
            <PlusIcon data-icon="inline-start" />
            New project
          </Button>
        </EmptyContent>
        <ProjectDialog
          mode={projectDialog}
          onOpenChange={(open) => setProjectDialog(open ? "create" : null)}
          activeName=""
          pending={projectMutation.isPending}
          error={projectError}
          onSubmit={saveProject}
        />
      </Empty>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted-foreground">Project board</p>
          <h1 className="truncate text-3xl font-semibold tracking-tight">
            {snapshot.activeProject.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setProjectDialog("create")}>
            <FolderPlusIcon data-icon="inline-start" />
            New project
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Project actions"
                />
              }
            >
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setProjectDialog("rename")}>
                  <PencilIcon /> Rename project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteProjectOpen(true)}
                >
                  <Trash2Icon /> Delete project
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() =>
              setTaskDialog({ open: true, status: "todo", task: null })
            }
          >
            <PlusIcon data-icon="inline-start" /> New task
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {columns.map((column) => {
          const tasks = snapshot.tasks.filter(
            (task) => task.status === column.status
          )
          return (
            <section
              key={column.status}
              aria-label={column.title}
              className="flex min-w-0 flex-col gap-3 rounded-4xl bg-muted/50 p-3"
            >
              <div className="flex items-center justify-between gap-3 px-1 py-1">
                <div>
                  <h2 className="font-medium">{column.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {column.description}
                  </p>
                </div>
                <Badge variant="secondary">{tasks.length}</Badge>
              </div>
              {tasks.length === 0 ? (
                <Empty className="min-h-40 border">
                  <EmptyHeader>
                    <EmptyTitle>No tasks</EmptyTitle>
                    <EmptyDescription>
                      Add the first task in this column.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setTaskDialog({
                          open: true,
                          status: column.status,
                          task: null,
                        })
                      }
                    >
                      <PlusIcon data-icon="inline-start" /> Add task
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                tasks.map((task) => (
                  <Card key={task.id} size="sm">
                    <CardHeader>
                      <CardTitle className="pe-8">{task.title}</CardTitle>
                      <CardDescription>
                        {task.notes || "No notes"}
                      </CardDescription>
                      <CardAction>
                        <TaskMenu
                          task={task}
                          onEdit={() =>
                            setTaskDialog({
                              open: true,
                              status: task.status,
                              task,
                            })
                          }
                          onDelete={() => setDeleteTaskTarget(task)}
                          onMove={(status) =>
                            updateTaskMutation.mutate({
                              taskId: task.id,
                              values: { status },
                            })
                          }
                        />
                      </CardAction>
                    </CardHeader>
                    {task.dueAt && (
                      <CardContent>
                        <Badge variant="outline">
                          <CalendarIcon />
                          {format(task.dueAt, "MMM d, yyyy")}
                        </Badge>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </section>
          )
        })}
      </div>

      <TaskDialog
        open={taskDialog.open}
        onOpenChange={(open) =>
          setTaskDialog((current) => ({ ...current, open }))
        }
        status={taskDialog.status}
        task={taskDialog.task}
        pending={createTaskMutation.isPending || updateTaskMutation.isPending}
        onSubmit={saveTask}
      />
      <ProjectDialog
        mode={projectDialog}
        onOpenChange={(open) =>
          setProjectDialog(open ? (projectDialog ?? "create") : null)
        }
        activeName={snapshot.activeProject.name}
        pending={projectMutation.isPending}
        error={projectError}
        onSubmit={saveProject}
      />
      <DeleteDialog
        open={deleteProjectOpen}
        onOpenChange={setDeleteProjectOpen}
        title="Delete this project?"
        description="Every task in the project will be permanently deleted."
        pending={deleteProjectMutation.isPending}
        onConfirm={() => deleteProjectMutation.mutate()}
      />
      <DeleteDialog
        open={Boolean(deleteTaskTarget)}
        onOpenChange={(open) => !open && setDeleteTaskTarget(null)}
        title="Delete this task?"
        description="This action cannot be undone."
        pending={deleteTaskMutation.isPending}
        onConfirm={() =>
          deleteTaskTarget && deleteTaskMutation.mutate(deleteTaskTarget.id)
        }
      />
    </div>
  )
}

function TaskMenu({
  task,
  onEdit,
  onDelete,
  onMove,
}: {
  task: TaskView
  onEdit: () => void
  onDelete: () => void
  onMove: (status: TaskStatus) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Actions for ${task.title}`}
          />
        }
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon /> Edit
          </DropdownMenuItem>
          {columns
            .filter((column) => column.status !== task.status)
            .map((column) => (
              <DropdownMenuItem
                key={column.status}
                onClick={() => onMove(column.status)}
              >
                Move to {column.title}
              </DropdownMenuItem>
            ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProjectDialog({
  mode,
  onOpenChange,
  activeName,
  pending,
  error,
  onSubmit,
}: {
  mode: "create" | "rename" | null
  onOpenChange: (open: boolean) => void
  activeName: string
  pending: boolean
  error: string | null
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "rename" ? "Rename project" : "Create project"}
          </DialogTitle>
          <DialogDescription>
            Use a short name that makes the board easy to recognize.
          </DialogDescription>
        </DialogHeader>
        <form
          key={mode ?? "closed"}
          method="post"
          onSubmit={onSubmit}
          className="flex flex-col gap-6"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input
                id="project-name"
                name="name"
                defaultValue={mode === "rename" ? activeName : ""}
                maxLength={80}
                aria-invalid={Boolean(error)}
                autoFocus
                required
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </FieldGroup>
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
              {pending ? "Saving…" : "Save project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  pending: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
