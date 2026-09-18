import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import {
  createProject,
  createTask,
  getProject,
  listProjects,
  listTasksByProject,
} from "./repository.server"

describe("project and task repositories", () => {
  it("creates projects with server-owned ids and deterministic listing", async () => {
    const first = await createProject("user-a", { name: "First" }, env.DB)
    const second = await createProject("user-a", { name: "Second" }, env.DB)

    expect(first.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(first.createdAt).toEqual(expect.any(Number))
    expect(await listProjects("user-a", env.DB)).toEqual([first, second])
  })

  it("returns nothing when another user reads a project or its tasks", async () => {
    const project = await createProject("owner", { name: "Private" }, env.DB)
    await createTask(
      "owner",
      { projectId: project.id, title: "Secret" },
      env.DB
    )

    await expect(getProject("stranger", project.id, env.DB)).resolves.toBeNull()
    await expect(
      listTasksByProject("stranger", project.id, env.DB)
    ).resolves.toEqual([])
  })

  it("creates tasks and lists them deterministically", async () => {
    const project = await createProject("owner", { name: "Board" }, env.DB)
    const second = await createTask(
      "owner",
      {
        projectId: project.id,
        title: "Second",
        status: "todo",
        position: 2,
      },
      env.DB
    )
    const first = await createTask(
      "owner",
      {
        projectId: project.id,
        title: "First",
        status: "todo",
        position: 1,
      },
      env.DB
    )

    await expect(
      listTasksByProject("owner", project.id, env.DB)
    ).resolves.toEqual([first, second])
  })

  it("rejects attaching a task to another user's project", async () => {
    const project = await createProject("owner", { name: "Private" }, env.DB)

    await expect(
      createTask(
        "stranger",
        { projectId: project.id, title: "Intrusion" },
        env.DB
      )
    ).rejects.toThrow()
  })

  it("enforces same-project and same-user parent scope", async () => {
    const firstProject = await createProject("owner", { name: "One" }, env.DB)
    const secondProject = await createProject("owner", { name: "Two" }, env.DB)
    const parent = await createTask(
      "owner",
      { projectId: firstProject.id, title: "Parent" },
      env.DB
    )

    await expect(
      createTask(
        "owner",
        {
          projectId: secondProject.id,
          parentId: parent.id,
          title: "Wrong scope",
        },
        env.DB
      )
    ).rejects.toThrow()
  })

  it("enforces the task status constraint", async () => {
    const project = await createProject("owner", { name: "Board" }, env.DB)

    await expect(
      env.DB.prepare(
        `INSERT INTO task (
          id, project_id, user_id, title, status, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          crypto.randomUUID(),
          project.id,
          "owner",
          "Invalid",
          "blocked",
          0,
          Date.now(),
          Date.now()
        )
        .run()
    ).rejects.toThrow()
  })

  it("cascades project deletion to tasks", async () => {
    const project = await createProject("owner", { name: "Temporary" }, env.DB)
    await createTask("owner", { projectId: project.id, title: "Child" }, env.DB)

    await env.DB.prepare("DELETE FROM project WHERE id = ? AND user_id = ?")
      .bind(project.id, "owner")
      .run()

    await expect(
      listTasksByProject("owner", project.id, env.DB)
    ).resolves.toEqual([])
  })
})
