import { z } from "zod"

import { postSlugPattern } from "./contracts"

type FrontmatterValue = string | string[]

function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value)
  return quoted ? quoted[2] : value
}

/**
 * Reads the frontmatter subset posts use: `key: value` lines, and lists
 * written `[a, b]` or as `- item` lines under an empty key. Anything else
 * is an error, so a typo fails the tests instead of vanishing.
 */
export function parseFrontmatter(
  raw: string
): Record<string, FrontmatterValue> {
  const fields: Record<string, FrontmatterValue> = {}
  let list: string[] | null = null

  for (const line of raw.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue

    const item = /^\s*-\s+(.+)$/.exec(line)
    if (item) {
      if (!list) throw new Error(`A list item needs a key above it: ${line}`)
      list.push(unquote(item[1].trim()))
      continue
    }

    const pair = /^([A-Za-z][\w-]*):(?:\s+(.*))?$/.exec(line)
    if (!pair) throw new Error(`Unreadable frontmatter line: ${line}`)
    const [, key, rawValue = ""] = pair
    if (Object.hasOwn(fields, key)) throw new Error(`Duplicate key: ${key}`)

    const value = rawValue.trim()
    if (!value) {
      list = []
      fields[key] = list
    } else if (value.startsWith("[") && value.endsWith("]")) {
      list = null
      fields[key] = value
        .slice(1, -1)
        .split(",")
        .map((entry) => unquote(entry.trim()))
        .filter(Boolean)
    } else {
      list = null
      fields[key] = unquote(value)
    }
  }
  return fields
}

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Write the date as YYYY-MM-DD.")
  .refine(
    (value) => new Date(`${value}T00:00:00Z`).toISOString().startsWith(value),
    "The date is not a real calendar day."
  )

/** What every post's frontmatter must hold. */
export const postFrontmatterSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(300),
  date: day,
  author: z.string().trim().min(1).max(80),
  tags: z.array(z.string().regex(postSlugPattern)).min(1).max(6),
})

export type PostFrontmatter = z.output<typeof postFrontmatterSchema>
