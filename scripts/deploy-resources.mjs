import { parse } from "jsonc-parser"

// `pnpm run deploy` deploys the top level of wrangler.jsonc, as the Deploy to
// Cloudflare button and a repository imported from the dashboard do. Wrangler
// creates missing resources while it deploys, but only after the step that
// applies D1 migrations, and it skips an R2 bucket without a word when
// Cloudflare refuses to say whether it exists, as it does before R2 is
// enabled. These helpers create what is missing first, or stop with a
// message that says what to do.

/** The `DB` database and `FILES` bucket of the top level of wrangler.jsonc. */
export function deployResources(source) {
  const errors = []
  const config = parse(source, errors, { allowTrailingComma: true })
  if (errors.length > 0 || !config || typeof config !== "object") {
    throw new Error("wrangler.jsonc could not be parsed.")
  }
  const database = (config.d1_databases ?? []).find(
    (candidate) => candidate.binding === "DB"
  )
  const bucket = (config.r2_buckets ?? []).find(
    (candidate) => candidate.binding === "FILES"
  )
  return {
    database: database?.database_name
      ? { name: database.database_name, id: database.database_id ?? null }
      : null,
    bucket: bucket?.bucket_name ? { name: bucket.bucket_name } : null,
  }
}

/**
 * Whether `wrangler d1 list --json` lists a database with this name, or null
 * when its standard output cannot be read.
 */
export function listsDatabase(stdout, name) {
  const text = stdout.trim()
  // Wrangler prints the list alone; anything before it is skipped.
  for (const candidate of [
    text,
    text.slice(Math.max(text.indexOf("\n["), 0)),
  ]) {
    try {
      const databases = JSON.parse(candidate)
      if (Array.isArray(databases)) {
        return databases.some((database) => database?.name === name)
      }
    } catch {
      // Try the next reading.
    }
  }
  return null
}

/**
 * What `wrangler r2 bucket info` found: `exists`, `missing`, `not-enabled`
 * when the account has no R2 subscription, `no-access` when Cloudflare
 * refused the request, or `unknown`.
 */
export function bucketStatus({ status, output }) {
  if (status === 0) return "exists"
  if (/\[code: 10006\]/.test(output)) return "missing"
  if (/\[code: 10042\]/.test(output)) return "not-enabled"
  if (/\[code: 10000\]|Authentication error/i.test(output)) {
    return "no-access"
  }
  return "unknown"
}

export const r2NotEnabledMessage =
  "R2 is not enabled on this Cloudflare account, so the attachments bucket cannot be created. In the Cloudflare dashboard, open R2 Object Storage and enable it, then deploy again (in Workers Builds, retry the build)."

export const r2NoAccessMessage =
  "Cloudflare refused to check the R2 attachments bucket. Enable R2 under R2 Object Storage in the dashboard; if it is enabled, give the API token the build uses R2 edit permission. Then deploy again."

/**
 * Creates the database and the bucket when they are missing. `wrangler`
 * runs one Wrangler command and returns `{ status, stdout, output }`, where
 * `output` joins standard output and standard error; `log` prints a line.
 * Throws, with what to do, when deploying cannot succeed.
 */
export function prepareResources({ database, bucket }, wrangler, log) {
  if (database && !database.id) {
    const listed = wrangler(["d1", "list", "--json"])
    const found =
      listed.status === 0 ? listsDatabase(listed.stdout, database.name) : null
    if (found === false) {
      log(`Creating the D1 database ${database.name}.`)
      const created = wrangler([
        "d1",
        "create",
        database.name,
        "--update-config=false",
      ])
      if (created.status !== 0) {
        throw new Error(
          `The D1 database ${database.name} could not be created:\n${created.output}`
        )
      }
    } else if (found === null) {
      log(
        `Could not list D1 databases; the migrations step reports it if ${database.name} is missing.`
      )
    }
  }

  if (bucket) {
    const info = wrangler(["r2", "bucket", "info", bucket.name, "--json"])
    const status = bucketStatus(info)
    if (status === "missing") {
      log(`Creating the R2 bucket ${bucket.name}.`)
      const created = wrangler([
        "r2",
        "bucket",
        "create",
        bucket.name,
        "--update-config=false",
      ])
      const createdStatus = bucketStatus(created)
      if (createdStatus === "not-enabled") throw new Error(r2NotEnabledMessage)
      if (createdStatus === "no-access") throw new Error(r2NoAccessMessage)
      if (created.status !== 0) {
        throw new Error(
          `The R2 bucket ${bucket.name} could not be created:\n${created.output}`
        )
      }
    } else if (status === "not-enabled") {
      throw new Error(r2NotEnabledMessage)
    } else if (status === "no-access") {
      throw new Error(r2NoAccessMessage)
    } else if (status === "unknown") {
      log(
        `Could not check the R2 bucket ${bucket.name}; deploying anyway:\n${info.output}`
      )
    }
  }
}
