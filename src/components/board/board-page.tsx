import { useEffect, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { format } from "date-fns"
import {
  CalendarIcon,
  ColumnsIcon,
  CornerDownRightIcon,
  EllipsisIcon,
  FolderPlusIcon,
  ListIcon,
  ListTreeIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"

import { TaskDialog } from "@/components/board/task-dialog"
import { TaskTable } from "@/components/board/task-table"
import { submitHandler, useAppForm, validateOnSubmit } from "@/components/form"
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
import { FieldError, FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import type { BreakdownState } from "@/modules/ai/contracts"
import { startTaskBreakdown } from "@/modules/ai/functions"
import {
  aiStatusQueryOptions,
  breakdownQueryOptions,
} from "@/modules/ai/queries"
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
import { useBoardRealtime } from "@/modules/realtime/use-board-realtime"
import type { RealtimeStatus } from "@/modules/realtime/use-board-realtime"
import { boardViews } from "@/modules/tasks/board-search"
import type { BoardSearch, BoardView } from "@/modules/tasks/board-search"
import { boardQueryKey, boardQueryOptions } from "@/modules/tasks/queries"
import { createProjectInputSchema } from "@/modules/tasks/schemas"
import type { TaskValues } from "@/modules/tasks/schemas"

const columns: Array<{
  status: TaskStatus
  title: string
  description: string
}> = [
  { status: "todo", title: "Todo", description: "Ready to start" },
  { status: "doing", title: "Doing", description: "In progress" },
  { status: "done", title: "Done", description: "Completed" },
]

const realtimeLabels: Record<RealtimeStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
}

function RealtimeIndicator({ status }: { status: RealtimeStatus }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className={
          status === "live"
            ? "size-2 rounded-full bg-emerald-500"
            : "size-2 animate-pulse rounded-full bg-amber-500"
        }
      />
      {realtimeLabels[status]}
    </span>
  )
}

const viewLabels: Record<BoardView, { label: string; icon: typeof ListIcon }> =
  {
    board: { label: "Board", icon: ColumnsIcon },
    list: { label: "List", icon: ListIcon },
  }

export function BoardPage({
  search,
  onSearchChange,
}: {
  /** `/app`'s search params: the project, the view, and the list's state. */
  search: BoardSearch
  onSearchChange: (patch: Partial<BoardSearch>) => void
}) {
  const projectId = search.project
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
  // Running AI breakdowns, by task ID.
  const [breakdowns, setBreakdowns] = useState<Record<string, string>>({})
  const aiStatus = useQuery(aiStatusQueryOptions()).data

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
      // The realtime echo of this task can arrive before this response, so
      // drop that copy while the optimistic entry takes the real task.
      updateCache((current) => ({
        ...current,
        tasks: current.tasks.flatMap((item) =>
          item.id === context.tempId
            ? [task]
            : item.id === task.id
              ? []
              : [item]
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

  const breakdownMutation = useMutation({
    mutationFn: (taskId: string) => startTaskBreakdown({ data: { taskId } }),
    onSuccess: ({ instanceId }, taskId) => {
      setBreakdowns((current) => ({ ...current, [taskId]: instanceId }))
      void queryClient.invalidateQueries({
        queryKey: aiStatusQueryOptions().queryKey,
      })
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: "Breakdown did not start",
        description: error.message,
      })
    },
  })

  function finishBreakdown(taskId: string, result: BreakdownState) {
    setBreakdowns(({ [taskId]: _finished, ...rest }) => rest)
    // Subtasks normally arrive over the socket; refetch in case it was down.
    void queryClient.invalidateQueries({ queryKey: key })
    void queryClient.invalidateQueries({
      queryKey: aiStatusQueryOptions().queryKey,
    })
    if (result.state === "done") {
      toast.add({
        type: "success",
        title: `Added ${result.created} subtasks`,
      })
    } else if (result.state === "failed") {
      toast.add({
        type: "error",
        title: "Breakdown failed",
        description: result.message,
      })
    }
  }

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

  const realtimeStatus = useBoardRealtime({
    queryKey: key,
    projectId: snapshot.activeProject?.id ?? null,
    onProjectEvent: (event) => {
      if (event.type === "project.renamed") {
        void router.invalidate()
        return
      }
      // This device's own delete already navigated; only react to others.
      if (event.type !== "project.deleted" || !deleteProjectMutation.isIdle) {
        return
      }
      toast.add({
        type: "info",
        title: "Project deleted",
        description: "It was deleted on another device.",
      })
      void queryClient.invalidateQueries({ queryKey: ["board"] })
      void router.invalidate()
      void navigate({ to: "/app", search: {} })
    },
  })

  async function saveProject(name: string) {
    await projectMutation
      .mutateAsync({ mode: projectDialog!, name })
      // The mutation reports the failure in the dialog.
      .catch(() => undefined)
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

  const titles = new Map(snapshot.tasks.map((task) => [task.id, task.title]))
  const subtaskCounts = new Map<string, number>()
  for (const task of snapshot.tasks) {
    if (task.parentId) {
      subtaskCounts.set(
        task.parentId,
        (subtaskCounts.get(task.parentId) ?? 0) + 1
      )
    }
  }

  function taskMenu(task: TaskView) {
    return (
      <TaskMenu
        task={task}
        onBreakdown={
          aiStatus?.enabled &&
          !task.parentId &&
          !subtaskCounts.has(task.id) &&
          !breakdowns[task.id] &&
          !task.id.startsWith("optimistic:")
            ? () => breakdownMutation.mutate(task.id)
            : undefined
        }
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
    )
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
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Project board</p>
            <RealtimeIndicator status={realtimeStatus} />
          </div>
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

      <Tabs
        value={search.view}
        onValueChange={(view) => onSearchChange({ view: view as BoardView })}
      >
        <TabsList aria-label="View">
          {boardViews.map((view) => {
            const { label, icon: Icon } = viewLabels[view]
            return (
              <TabsTrigger key={view} value={view}>
                <Icon data-icon="inline-start" />
                {label}
              </TabsTrigger>
            )
          })}
        </TabsList>
        <TabsContent value="board" className="pt-2">
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
                          {task.parentId && titles.has(task.parentId) && (
                            <p className="flex min-w-0 items-center gap-1 pe-8 text-xs text-muted-foreground">
                              <CornerDownRightIcon className="size-3 shrink-0" />
                              <span className="truncate">
                                Part of {titles.get(task.parentId)}
                              </span>
                            </p>
                          )}
                          <CardTitle className="pe-8">{task.title}</CardTitle>
                          <CardDescription>
                            {task.notes || "No notes"}
                          </CardDescription>
                          <CardAction>{taskMenu(task)}</CardAction>
                        </CardHeader>
                        {(task.dueAt ||
                          subtaskCounts.has(task.id) ||
                          breakdowns[task.id]) && (
                          <CardContent className="flex flex-wrap items-center gap-2">
                            {task.dueAt && (
                              <Badge variant="outline">
                                <CalendarIcon />
                                {format(task.dueAt, "MMM d, yyyy")}
                              </Badge>
                            )}
                            {subtaskCounts.has(task.id) && (
                              <Badge variant="outline">
                                <ListTreeIcon />
                                {subtaskCounts.get(task.id)} subtasks
                              </Badge>
                            )}
                            {breakdowns[task.id] && (
                              <BreakdownProgress
                                instanceId={breakdowns[task.id]}
                                onFinished={(result) =>
                                  finishBreakdown(task.id, result)
                                }
                              />
                            )}
                          </CardContent>
                        )}
                      </Card>
                    ))
                  )}
                </section>
              )
            })}
          </div>
        </TabsContent>
        <TabsContent value="list" className="pt-2">
          <TaskTable
            tasks={snapshot.tasks}
            projectName={snapshot.activeProject.name}
            search={search}
            onSearchChange={onSearchChange}
            renderActions={taskMenu}
          />
        </TabsContent>
      </Tabs>

      <TaskDialog
        open={taskDialog.open}
        onOpenChange={(open) =>
          setTaskDialog((current) => ({ ...current, open }))
        }
        status={taskDialog.status}
        task={taskDialog.task}
        onSubmit={saveTask}
      />
      <ProjectDialog
        mode={projectDialog}
        onOpenChange={(open) =>
          setProjectDialog(open ? (projectDialog ?? "create") : null)
        }
        activeName={snapshot.activeProject.name}
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

function BreakdownProgress({
  instanceId,
  onFinished,
}: {
  instanceId: string
  onFinished: (result: BreakdownState) => void
}) {
  const { data, error } = useQuery(breakdownQueryOptions(instanceId))

  useEffect(() => {
    if (data && data.state !== "running") onFinished(data)
    if (error) onFinished({ state: "failed", message: error.message })
    // Only a new result matters; onFinished is recreated on every render.
  }, [data, error])

  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <Spinner className="size-3" />
      Breaking down…
    </span>
  )
}

function TaskMenu({
  task,
  onEdit,
  onBreakdown,
  onDelete,
  onMove,
}: {
  task: TaskView
  onEdit: () => void
  onBreakdown?: () => void
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
          {onBreakdown && (
            <DropdownMenuItem onClick={onBreakdown}>
              <SparklesIcon /> Break down with AI
            </DropdownMenuItem>
          )}
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
  error,
  onSubmit,
}: {
  mode: "create" | "rename" | null
  onOpenChange: (open: boolean) => void
  activeName: string
  error: string | null
  onSubmit: (name: string) => Promise<void>
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
        <ProjectForm
          key={mode ?? "closed"}
          defaultName={mode === "rename" ? activeName : ""}
          error={error}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  )
}

function ProjectForm({
  defaultName,
  error,
  onCancel,
  onSubmit,
}: {
  defaultName: string
  error: string | null
  onCancel: () => void
  onSubmit: (name: string) => Promise<void>
}) {
  const form = useAppForm({
    defaultValues: { name: defaultName },
    validationLogic: validateOnSubmit,
    // The schema createProject and renameProject validate the name with.
    validators: { onDynamic: createProjectInputSchema },
    onSubmit: ({ value }) =>
      onSubmit(createProjectInputSchema.parse(value).name),
  })

  return (
    <form
      method="post"
      onSubmit={submitHandler(form)}
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              id="project-name"
              label="Name"
              maxLength={80}
              autoFocus
              required
            />
          )}
        </form.AppField>
        {error && <FieldError>{error}</FieldError>}
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <form.AppForm>
          <form.SubmitButton pendingLabel="Saving…">
            Save project
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
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
