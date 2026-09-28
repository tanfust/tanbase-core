import { parse } from "jsonc-parser"

import { hasSecret } from "./setup/core.mjs"

// `pnpm run deploy` deploys the top level of wrangler.jsonc, as the Deploy to
// Cloudflare button and a repository imported from the dashboard do. It must
// work on a first try from an account with nothing set up (ADR-0021). These
// helpers decide what that deploy does:
//
// - D1: Wrangler creates a missing database only after the step that applies
//   migrations, so the database is created first.
// - R2: enabling it is an account opt-in only the owner can do. The top level
//   declares no bucket; each deploy binds `FILES` when R2 is enabled and
//   deploys without attachments when it is not.
// - BETTER_AUTH_SECRET: the first deploy creates one; later deploys keep it.

/** A JSON or JSONC configuration file, or an error naming it. */
export function parseConfig(source, label) {
  const errors = []
  const config = parse(source, errors, { allowTrailingComma: true })
  if (errors.length > 0 || !config || typeof config !== "object") {
    throw new Error(`${label} could not be parsed.`)
  }
  return config
}

/** The `DB` database, any declared `FILES` bucket, and the Worker name. */
export function deployResources(source) {
  const config = parseConfig(source, "wrangler.jsonc")
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
    // Copies made before ADR-0021 declared the bucket; they keep its name.
    bucket: bucket?.bucket_name ? { name: bucket.bucket_name } : null,
    name: typeof config.name === "string" ? config.name : null,
  }
}

/**
 * The Worker this deploy targets. Workers Builds names it after the project
 * and passes that name to `wrangler deploy` alone, through
 * `WRANGLER_CI_OVERRIDE_NAME`; every other command must be given it.
 */
export function resolveWorkerName({ override, built, config }) {
  const name = [override, built, config].find(
    (candidate) => typeof candidate === "string" && candidate.trim()
  )
  if (!name) throw new Error("The Worker has no name in wrangler.jsonc.")
  return name.trim()
}

const bucketNameLimit = 63
const bucketSuffix = "-files"

/** The attachments bucket for a Worker: `<worker>-files`, a valid R2 name. */
export function filesBucketName(worker) {
  const base = worker
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, bucketNameLimit - bucketSuffix.length)
    .replace(/-$/, "")
  return `${base || "tanbase-core"}${bucketSuffix}`
}

/** Whether a generated configuration is a build of the top level. */
export function isTopLevelBuild(config) {
  return !config.targetEnvironment
}

/**
 * A copy of a generated configuration whose `FILES` binding is `bucket`, or
 * which has none when `bucket` is null. Other buckets are kept.
 */
export function withFilesBinding(config, bucket) {
  const others = (config.r2_buckets ?? []).filter(
    (candidate) => candidate.binding !== "FILES"
  )
  return {
    ...config,
    r2_buckets: bucket
      ? [...others, { binding: "FILES", bucket_name: bucket }]
      : others,
  }
}

/** The JSON array a command printed, or null. */
function jsonArray(stdout) {
  const text = stdout.trim()
  // Wrangler prints the value alone; a warning line before it is skipped.
  for (const candidate of [
    text,
    text.slice(Math.max(text.indexOf("\n["), 0)),
  ]) {
    try {
      const value = JSON.parse(candidate)
      if (Array.isArray(value)) return value
    } catch {
      // Try the next reading.
    }
  }
  return null
}

/**
 * Whether `wrangler d1 list --json` lists a database with this name, or null
 * when its standard output cannot be read.
 */
export function listsDatabase(stdout, name) {
  const databases = jsonArray(stdout)
  return databases
    ? databases.some((database) => database?.name === name)
    : null
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

export const attachmentsOffMessage =
  "Attachments are off: enable R2 under R2 Object Storage in the Cloudflare dashboard, then redeploy to turn them on."

export const attachmentsNoAccessMessage =
  "Attachments are off: Cloudflare refused to check the R2 bucket. Enable R2 under R2 Object Storage; if it is enabled, give the API token the build uses R2 edit permission. Then redeploy."

/**
 * Creates the database when it is missing. `wrangler` runs one Wrangler
 * command and returns `{ status, stdout, output }`, where `output` joins
 * standard output and standard error; `log` prints a line. Throws when the
 * database cannot be created, since the site cannot work without it.
 */
export function prepareDatabase(database, wrangler, log) {
  if (!database || database.id) return
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

/**
 * The attachments bucket to bind, created when missing, or null when R2 is
 * not available. Never throws: the site works without attachments.
 */
export function prepareFiles(bucket, wrangler, log) {
  let info = wrangler(["r2", "bucket", "info", bucket, "--json"])
  let status = bucketStatus(info)
  if (status === "unknown") {
    info = wrangler(["r2", "bucket", "info", bucket, "--json"])
    status = bucketStatus(info)
  }

  if (status === "missing") {
    log(`Creating the R2 bucket ${bucket}.`)
    const created = wrangler([
      "r2",
      "bucket",
      "create",
      bucket,
      "--update-config=false",
    ])
    if (created.status === 0) return bucket
    status = bucketStatus(created)
    if (status !== "not-enabled" && status !== "no-access") {
      log(
        `Attachments are off: the R2 bucket ${bucket} could not be created:\n${created.output}`
      )
      return null
    }
  }

  if (status === "exists") return bucket
  if (status === "not-enabled") log(attachmentsOffMessage)
  else if (status === "no-access") log(attachmentsNoAccessMessage)
  else {
    log(
      `Attachments are off for this deploy: the R2 bucket ${bucket} could not be checked:\n${info.output}`
    )
  }
  return null
}

/**
 * Whether the Worker has `BETTER_AUTH_SECRET`, from `wrangler secret list
 * --format json`: `present`, `absent`, `no-worker` before the first deploy,
 * or `unknown`. Only `absent` and `no-worker` may create a secret; guessing
 * wrong would replace a working one and sign everyone out.
 */
export function secretStatus({ status, stdout, output }) {
  if (status === 0) {
    const secrets = jsonArray(stdout)
    if (!secrets) return "unknown"
    return hasSecret(secrets, "BETTER_AUTH_SECRET") ? "present" : "absent"
  }
  if (/\[code: 10000\]|Authentication error/i.test(output)) return "unknown"
  if (
    /\[code: (10007|10090)\]/.test(output) ||
    /Worker "[^"]*"[^\n]* not found/.test(output)
  ) {
    return "no-worker"
  }
  return "unknown"
}

/** Whether this deploy creates `BETTER_AUTH_SECRET`. */
export function shouldCreateSecret(status) {
  return status === "absent" || status === "no-worker"
}

export const secretCheckWarning =
  "Could not check whether the Worker has BETTER_AUTH_SECRET, so none is created. If the sign-in page says the site is not set up, redeploy."
