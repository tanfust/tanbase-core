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

describe("the README", () => {
  it("names every product on the homepage's primitive map", () => {
    const builtWith = section("Built with")
    for (const { feature, product, bindings } of homepage.primitives.items) {
      const uses = bindings.map((binding) => `\`${binding}\``).join(", ")
      expect(builtWith).toContain(`- **${product}**: ${feature} (${uses})\n`)
    }
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
