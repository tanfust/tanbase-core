import { describe, expect, it } from "vitest"

import { InvalidModelOutputError, parseSubtasks } from "./subtasks"

const three = {
  subtasks: [{ title: "Draft" }, { title: "Review" }, { title: "Ship" }],
}

describe("subtask validation", () => {
  it("accepts JSON Mode objects, JSON strings, and fenced JSON", () => {
    expect(parseSubtasks(three)).toEqual(["Draft", "Review", "Ship"])
    expect(parseSubtasks(JSON.stringify(three))).toEqual([
      "Draft",
      "Review",
      "Ship",
    ])
    expect(
      parseSubtasks(`\`\`\`json\n${JSON.stringify(three)}\n\`\`\``)
    ).toEqual(["Draft", "Review", "Ship"])
  })

  it("trims titles and drops exact duplicates", () => {
    expect(
      parseSubtasks({
        subtasks: [
          { title: "  Draft " },
          { title: "Review" },
          { title: "Ship" },
          { title: "Ship" },
        ],
      })
    ).toEqual(["Draft", "Review", "Ship"])
  })

  // Fixtures of malformed output seen from, or plausible for, text models.
  const malformed: [string, unknown][] = [
    ["prose instead of JSON", "Sure! Here are some subtasks: 1. Draft"],
    ["truncated JSON", '{"subtasks":[{"title":"Draft"},{"tit'],
    [
      "a bare array",
      [{ title: "Draft" }, { title: "Review" }, { title: "Ship" }],
    ],
    ["a different key", { tasks: three.subtasks }],
    ["too few subtasks", { subtasks: three.subtasks.slice(0, 2) }],
    [
      "too many subtasks",
      {
        subtasks: Array.from({ length: 8 }, (_, i) => ({ title: `Step ${i}` })),
      },
    ],
    ["an empty title", { subtasks: [...three.subtasks, { title: "   " }] }],
    ["a non-string title", { subtasks: [...three.subtasks, { title: 42 }] }],
    [
      "a title over 200 characters",
      { subtasks: [...three.subtasks, { title: "x".repeat(201) }] },
    ],
    [
      "duplicates leaving fewer than three",
      { subtasks: [{ title: "Draft" }, { title: "Draft" }, { title: "Ship" }] },
    ],
    ["nothing", undefined],
  ]

  it.each(malformed)("rejects %s", (_, response) => {
    expect(() => parseSubtasks(response)).toThrow(InvalidModelOutputError)
  })
})
