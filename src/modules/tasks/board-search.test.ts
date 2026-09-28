import { describe, expect, it } from "vitest"

import {
  boardSearchDefaults,
  maxTaskSearchLength,
  parseBoardSearch,
} from "./board-search"

// The router hands the parser whatever the URL held.
function parse(raw: Record<string, unknown>) {
  return parseBoardSearch(raw as Parameters<typeof parseBoardSearch>[0])
}

describe("board search params", () => {
  it("fills every default when the URL names none", () => {
    expect(parse({})).toEqual({
      ...boardSearchDefaults,
      project: undefined,
      sort: undefined,
    })
  })

  it("keeps a shared list view", () => {
    expect(
      parse({
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
    expect(parse({ q: longest }).q).toBe(longest)
    expect(parse({ q: `${longest}x` }).q).toBe("")
  })

  it("falls back per param instead of failing on a malformed link", () => {
    expect(
      parse({
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

  it("keeps a list only when every item is valid", () => {
    expect(parse({ status: ["done", "todo"] }).status).toEqual(["done", "todo"])
    expect(parse({ status: ["done", "blocked"] }).status).toEqual([])
    expect(parse({ hide: "notes" }).hide).toEqual([])
    expect(parse({ desc: "true" }).desc).toBe(false)
  })
})
