import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const requiredFrontmatter = ["status", "audience", "last_verified"]
const requiredChangeSections = [
  "Summary",
  "Motivation",
  "Behavior and configuration changes",
  "Migrations and environment changes",
  "Validation evidence",
  "Deployment state",
  "Rollback notes",
  "Remaining work",
]
const requiredAdrSections = [
  "Context",
  "Decision",
  "Consequences",
  "Alternatives",
]
const errors = []

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return extname(entry.name) === ".md" ? [path] : []
  })
}

const files = [
  join(root, "README.md"),
  join(root, "AGENTS.md"),
  join(root, "CLAUDE.md"),
  ...markdownFiles(join(root, "docs")),
]

for (const file of files) {
  const display = relative(root, file)
  if (!existsSync(file)) {
    errors.push(`${display}: file is required`)
    continue
  }

  const source = readFileSync(file, "utf8")
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)

  if (!frontmatter) {
    errors.push(`${display}: missing YAML frontmatter`)
  } else {
    for (const key of requiredFrontmatter) {
      if (!new RegExp(`^${key}:\\s*\\S`, "m").test(frontmatter[1])) {
        errors.push(`${display}: missing frontmatter field ${key}`)
      }
    }
  }

  const isChange =
    display.startsWith("docs/changes/") && !display.endsWith("/README.md")
  if (isChange) {
    for (const heading of requiredChangeSections) {
      if (!source.includes(`## ${heading}`)) {
        errors.push(`${display}: missing section ${heading}`)
      }
    }
  }

  const isAdr =
    display.startsWith("docs/decisions/") && !display.endsWith("/README.md")
  if (isAdr) {
    for (const heading of requiredAdrSections) {
      if (!source.includes(`## ${heading}`)) {
        errors.push(`${display}: missing section ${heading}`)
      }
    }
  }

  const links = source.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g)
  for (const match of links) {
    const target = match[1].trim().replace(/^<|>$/g, "").split("#")[0]
    if (
      !target ||
      target.startsWith("#") ||
      target.startsWith("/") ||
      /^[a-z][a-z\d+.-]*:/i.test(target)
    ) {
      continue
    }

    const decoded = decodeURIComponent(target)
    if (!existsSync(resolve(dirname(file), decoded))) {
      errors.push(`${display}: broken internal link ${target}`)
    }
  }
}

if (errors.length > 0) {
  console.error(`Documentation check failed:\n- ${errors.join("\n- ")}`)
  process.exit(1)
}

console.log(`Documentation check passed (${files.length} maintained files).`)
