import { describe, expect, it } from "vitest"

import { boardSearchDefaults, boardSearchSchema } from "./board-search"

describe("board search params", () => {
  it("fills every default when the URL names none", () => {
    expect(boardSearchSchema.parse({})).toEqual({
      ...boardSearchDefaults,
      project: undefined,
      sort: undefined,
    })
  })

  it("keeps a shared list view", () => {
    expect(
      boardSearchSchema.parse({
        project: "project-1",
        view: "list",
        q: "guide",
        status: ["todo", "done"],
        sort: "dueAt",
        desc: true,
        hide: ["notes"],
      })
    ).toEqual({
      project: "project-1",
      view: "list",
      q: "guide",
      status: ["todo", "done"],
      sort: "dueAt",
      desc: true,
      hide: ["notes"],
    })
  })

  it("falls back per param instead of failing on a malformed link", () => {
    expect(
      boardSearchSchema.parse({
        project: "",
        view: "grid",
        q: 42,
        status: ["blocked"],
        sort: "position",
        desc: "yes",
        hide: ["title"],
      })
    ).toEqual({
      ...boardSearchDefaults,
      project: undefined,
      sort: undefined,
    })
  })
})
