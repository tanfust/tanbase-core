import { createServerFn } from "@tanstack/react-start"

import {
  boardInputSchema,
  createProjectInputSchema,
  createTaskInputSchema,
  deleteProjectInputSchema,
  deleteTaskInputSchema,
  renameProjectInputSchema,
  updateTaskInputSchema,
} from "./schemas"

export const getProjects = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getProjectsImpl } = await import("./functions.server")
    return getProjectsImpl()
  }
)

export const getBoard = createServerFn({ method: "GET" })
  .validator(boardInputSchema)
  .handler(async ({ data }) => {
    const { getBoardImpl } = await import("./functions.server")
    return getBoardImpl(data)
  })

export const createProject = createServerFn({ method: "POST" })
  .validator(createProjectInputSchema)
  .handler(async ({ data }) => {
    const { createProjectImpl } = await import("./functions.server")
    return createProjectImpl(data)
  })

export const renameProject = createServerFn({ method: "POST" })
  .validator(renameProjectInputSchema)
  .handler(async ({ data }) => {
    const { renameProjectImpl } = await import("./functions.server")
    return renameProjectImpl(data)
  })

export const deleteProject = createServerFn({ method: "POST" })
  .validator(deleteProjectInputSchema)
  .handler(async ({ data }) => {
    const { deleteProjectImpl } = await import("./functions.server")
    return deleteProjectImpl(data)
  })

export const createTask = createServerFn({ method: "POST" })
  .validator(createTaskInputSchema)
  .handler(async ({ data }) => {
    const { createTaskImpl } = await import("./functions.server")
    return createTaskImpl(data)
  })

export const updateTask = createServerFn({ method: "POST" })
  .validator(updateTaskInputSchema)
  .handler(async ({ data }) => {
    const { updateTaskImpl } = await import("./functions.server")
    return updateTaskImpl(data)
  })

export const deleteTask = createServerFn({ method: "POST" })
  .validator(deleteTaskInputSchema)
  .handler(async ({ data }) => {
    const { deleteTaskImpl } = await import("./functions.server")
    return deleteTaskImpl(data)
  })
