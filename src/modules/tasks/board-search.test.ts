import { describe, expect, it } from "vitest"

import {
  boardSearchDefaults,
  boardSearchSchema,
  maxTaskSearchLength,
} from "./board-search"

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

  it("keeps a search up to the search box's limit", () => {
    const longest = "x".repeat(maxTaskSearchLength)
    expect(boardSearchSchema.parse({ q: longest }).q).toBe(longest)
    expect(boardSearchSchema.parse({ q: `${longest}x` }).q).toBe("")
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
