import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { homepage } from "./homepage"

// Runs in the jsdom suite, which has Node's file system, so the README can
// be checked against the homepage copy it repeats. Vitest runs from the
// repository root.
const readme = readFileSync(join(process.cwd(), "README.md"), "utf8")

function section(heading: string) {
  const start = readme.indexOf(`\n## ${heading}\n`)
  expect(start, `README has a "${heading}" section`).toBeGreaterThan(-1)
  const end = readme.indexOf("\n## ", start + 1)
  return readme.slice(start, end === -1 ? undefined : end)
}

function tableRows(markdown: string) {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line))
    .slice(1)
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())
    )
}

describe("the README", () => {
  it("lists the homepage's primitive map, row for row", () => {
    expect(tableRows(section("Primitive map"))).toEqual(
      homepage.primitives.items.map(({ feature, product, bindings }) => [
        feature,
        product,
        bindings.map((binding) => `\`${binding}\``).join(", "),
      ])
    )
  })

  it("repeats the homepage's cost risks and guardrails", () => {
    const cost = section("Cost")
    for (const item of [
      ...homepage.cost.risks.items,
      ...homepage.cost.guardrails.items,
    ]) {
      expect(cost).toContain(`- ${item}\n`)
    }
  })
})
