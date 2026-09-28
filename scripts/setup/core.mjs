import { applyEdits, modify, parse } from "jsonc-parser"

export const setupStateVersion = 1

// Cloudflare's documented always-pass Turnstile test secret. It pairs with the
// local test site key in wrangler.jsonc and is not a credential.
export const localTurnstileTestSecret = "1x0000000000000000000000000000000AA"

const workerNamePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * The cloud region in the same metro area as a D1 primary's colo, the
 * three-letter airport code in `meta.served_by_colo`. Only pairs in the same
 * city, or very close, belong here. Every value must be an identifier from
 * `GET /accounts/{account_id}/workers/placement/regions`.
 */
export const placementRegionByColo = Object.freeze({
  AMS: "azure:westeurope",
  ARN: "aws:eu-north-1",
  BOM: "aws:ap-south-1",
  CDG: "aws:eu-west-3",
  DUB: "aws:eu-west-1",
  FRA: "aws:eu-central-1",
  GRU: "aws:sa-east-1",
  HKG: "aws:ap-east-1",
  HND: "aws:ap-northeast-1",
  IAD: "aws:us-east-1",
  ICN: "aws:ap-northeast-2",
  JNB: "azure:southafricanorth",
  KIX: "aws:ap-northeast-3",
  LAX: "gcp:us-west2",
  LHR: "aws:eu-west-2",
  MAD: "azure:spaincentral",
  MEL: "aws:ap-southeast-4",
  MRS: "azure:francesouth",
  MXP: "aws:eu-south-1",
  NRT: "aws:ap-northeast-1",
  ORD: "azure:northcentralus",
  SEA: "azure:westus2",
  SIN: "aws:ap-southeast-1",
  SJC: "aws:us-west-1",
  SYD: "aws:ap-southeast-2",
  VIE: "azure:austriaeast",
  WAW: "azure:polandcentral",
  YYZ: "gcp:northamerica-northeast2",
  ZRH: "azure:switzerlandnorth",
})

/**
 * One region per D1 location hint, `meta.served_by_region`, for a colo
 * missing from the table above.
 */
export const placementRegionByLocationHint = Object.freeze({
  APAC: "aws:ap-southeast-1",
  EEUR: "azure:polandcentral",
  ENAM: "aws:us-east-1",
  OC: "aws:ap-southeast-2",
  WEUR: "aws:eu-central-1",
  WNAM: "aws:us-west-1",
})

const placementRegionPattern = /^[a-z]+:[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Whether a value has the `provider:region` shape, such as `aws:us-east-1`. */
export function isPlacementRegion(value) {
  return typeof value === "string" && placementRegionPattern.test(value)
}

/**
 * Wrangler arguments for one read-only query whose result reports where a
 * D1 database's primary is. `database` is a binding, name, or ID.
 */
export function d1LocationArgs(database, environment) {
  return [
    "d1",
    "execute",
    database,
    ...(environment ? ["--env", environment] : []),
    "--remote",
    "--command",
    "select 1",
    "--json",
  ]
}

/**
 * Reads `wrangler d1 execute --remote --json` output and returns the colo
 * and location hint of the primary that served the query, or null when the
 * output does not say, including when a replica served it.
 */
export function parseD1Location(output) {
  if (typeof output !== "string") return null
  const text = output.trim()
  let value = null
  // Anything Wrangler prints before the JSON, such as a warning, is skipped.
  for (const candidate of [text, text.slice(Math.max(text.indexOf("["), 0))]) {
    try {
      value = JSON.parse(candidate)
      break
    } catch {
      value = null
    }
  }
  const items = Array.isArray(value)
    ? value
    : Array.isArray(value?.result)
      ? value.result
      : [value]

  for (const item of items) {
    const meta = item?.meta
    if (item?.success === false || meta?.served_by_primary !== true) continue
    const colo = meta.served_by_colo
    const region = meta.served_by_region
    if (typeof colo !== "string" || !/^[a-z]{3}$/i.test(colo)) continue
    if (typeof region !== "string" || !/^[a-z]+$/i.test(region)) continue
    return { colo: colo.toUpperCase(), region: region.toUpperCase() }
  }
  return null
}

/**
 * The placement region next to a D1 primary: by its colo when the colo is
 * known, else by its location hint, else null.
 */
export function placementRegionFor(location) {
  if (!location) return null
  const colo = String(location.colo ?? "").toUpperCase()
  const hint = String(location.region ?? "").toUpperCase()
  if (Object.hasOwn(placementRegionByColo, colo)) {
    return placementRegionByColo[colo]
  }
  if (Object.hasOwn(placementRegionByLocationHint, hint)) {
    return placementRegionByLocationHint[hint]
  }
  return null
}

/** The `placement` value for a region, on one line as the repository writes it. */
export function placementValue(region) {
  return `{ "region": ${JSON.stringify(region)} }`
}

export function deriveWorkerName(value) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "")

  return normalized || "tanbase-core"
}

export function parseArguments(argv, defaultWorkerName = "tanbase-core") {
  const options = {
    accountId: null,
    appDescription: null,
    appName: null,
    dryRun: false,
    help: false,
    localOnly: false,
    placement: null,
    reuseExisting: false,
    workerName: defaultWorkerName,
    yes: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    switch (argument) {
      case "--":
        break
      case "--account-id":
        options.accountId = argv[++index] ?? null
        break
      case "--app-name":
        options.appName = argv[++index]?.trim() || null
        break
      case "--description":
        options.appDescription = argv[++index]?.trim() || null
        break
      case "--dry-run":
        options.dryRun = true
        break
      case "--help":
      case "-h":
        options.help = true
        break
      case "--local-only":
        options.localOnly = true
        break
      case "--name":
        options.workerName = argv[++index] ?? ""
        break
      case "--placement": {
        const value = argv[++index]
        if (value !== "default" && !isPlacementRegion(value)) {
          throw new Error(
            "--placement takes a region such as azure:francesouth, or default."
          )
        }
        options.placement = value
        break
      }
      case "--reuse-existing":
        options.reuseExisting = true
        break
      case "--yes":
      case "-y":
        options.yes = true
        break
      default:
        throw new Error(`Unknown option: ${argument}`)
    }
  }

  if (!workerNamePattern.test(options.workerName)) {
    throw new Error(
      "Worker names must use lowercase letters, numbers, and dashes, with no leading or trailing dash."
    )
  }

  if (options.localOnly && options.accountId) {
    throw new Error("--account-id cannot be combined with --local-only.")
  }
  if (options.localOnly && options.placement) {
    throw new Error("--placement cannot be combined with --local-only.")
  }

  return options
}

function placementStep(placement) {
  if (placement === "default") {
    return "Keep the production Worker on default placement (--placement default)"
  }
  if (placement) {
    return `Place the production Worker in ${placement} (--placement)`
  }
  return "Place the production Worker next to its D1 primary, or keep default placement when its location cannot be read"
}

export function setupPlan({ localOnly, placement = null }) {
  const localSteps = [
    "Create local-only Better Auth and Turnstile test secrets when missing",
    "Apply and seed the isolated local D1 database",
  ]

  if (localOnly) {
    return [
      "Name the app in src/lib/site.ts",
      "Install locked dependencies",
      ...localSteps,
      "Regenerate Worker types and run pnpm verify",
    ]
  }

  return [
    "Name the app in src/lib/site.ts",
    "Install locked dependencies",
    "Authorize and select a Cloudflare account",
    "Create or safely reuse the production Worker and D1 database",
    placementStep(placement),
    "Create or safely reuse the production R2 bucket, or turn attachments off when R2 is not enabled",
    "Create or safely reuse the reminder queue and its dead-letter queue, or turn reminders off",
    "Personalize Wrangler, canonical URLs, and local configuration",
    ...localSteps,
    "Regenerate Worker types, verify, and run the production dry run",
    "Apply production migrations before application code",
    "Keep the production Turnstile site key only when its Worker secret exists",
    "Keep the production email sender only when its sending domain is onboarded",
    "Deploy with a generated Better Auth secret when missing",
    "Reconcile the workers.dev URL and deploy the final verified build",
    "Run production health, database, SSR, auth-redirect, and SEO smoke checks",
    "Record non-secret resumable setup state",
  ]
}

function parseJsonc(source) {
  const errors = []
  const value = parse(source, errors, { allowTrailingComma: true })
  if (errors.length > 0 || !value || typeof value !== "object") {
    throw new Error("wrangler.jsonc could not be parsed safely.")
  }
  return value
}

const formattingOptions = { eol: "\n", insertSpaces: true, tabSize: 2 }

function updateJsonc(source, path, value) {
  const edits = modify(source, path, value, { formattingOptions })
  return applyEdits(source, edits)
}

/**
 * Sets the `placement` object at `path` to `{ "region": region }`, or removes
 * it when `region` is null. A new hint goes right after the section's `name`.
 * The value is written on one line: jsonc-parser would spread it over three
 * without the trailing comma Prettier adds, which fails `pnpm format:check`.
 */
function writePlacement(source, path, region) {
  if (region === null) return updateJsonc(source, path, undefined)
  if (!isPlacementRegion(region)) {
    throw new Error(
      `${region} is not a placement region such as azure:francesouth.`
    )
  }
  const marker = "<tanbase placement>"
  const edits = modify(source, path, marker, {
    formattingOptions,
    getInsertionIndex: (properties) => {
      const name = properties.indexOf("name")
      return name >= 0 ? name + 1 : properties.length
    },
  })
  return applyEdits(source, edits).replace(JSON.stringify(marker), () =>
    placementValue(region)
  )
}

/**
 * Sets or removes (`region: null`) the placement hint of one section of
 * wrangler.jsonc: `env.<environment>`, or the top level without one.
 */
export function updatePlacement(source, { environment = null, region }) {
  const config = parseJsonc(source)
  if (environment && !config.env?.[environment]) {
    throw new Error(`wrangler.jsonc has no env.${environment} section.`)
  }
  return writePlacement(
    source,
    environment ? ["env", environment, "placement"] : ["placement"],
    region
  )
}

/**
 * The `DB` database and placement of one section of wrangler.jsonc:
 * `env.<environment>`, or the top level, which the Deploy to Cloudflare
 * button deploys, without one.
 */
export function readPlacementTarget(source, environment = null) {
  const config = parseJsonc(source)
  const section = environment ? config.env?.[environment] : config
  const label = environment ? `env.${environment}` : "the top level"
  if (!section) {
    throw new Error(`wrangler.jsonc has no env.${environment} section.`)
  }
  const database = (section.d1_databases ?? []).find(
    (candidate) => candidate.binding === "DB"
  )
  if (!database) {
    throw new Error(`${label} of wrangler.jsonc has no DB binding.`)
  }
  return {
    databaseId: database.database_id ?? null,
    databaseName: database.database_name ?? null,
    placement: section.placement ?? null,
  }
}

export function readWranglerInstallation(source) {
  const config = parseJsonc(source)
  const production = config.env?.production
  const productionDatabase = production?.d1_databases?.[0]

  return {
    accountId: config.account_id ?? null,
    databaseId: productionDatabase?.database_id ?? null,
    databaseName: productionDatabase?.database_name ?? null,
    emailFrom: production?.vars?.EMAIL_FROM ?? null,
    filesBucketName:
      production?.r2_buckets?.find((bucket) => bucket.binding === "FILES")
        ?.bucket_name ?? null,
    placementRegion: production?.placement?.region ?? null,
    productionUrl: production?.vars?.BETTER_AUTH_URL ?? null,
    reminderQueueName:
      production?.queues?.producers?.find(
        (producer) => producer.binding === "EMAIL_QUEUE"
      )?.queue ?? null,
    turnstileSiteKey: production?.vars?.TURNSTILE_SITE_KEY ?? null,
    workerName: production?.name ?? config.name ?? null,
  }
}

/**
 * Personalizes wrangler.jsonc for one installation. `placementRegion` sets
 * the production placement hint to that region, `null` removes it, and
 * leaving it out means the database's location is unknown: the hint then
 * stays for the same database and is removed for a different one.
 */
export function updateWranglerInstallation(
  source,
  {
    accountId,
    databaseId,
    databaseName,
    disableEmail = false,
    disableFiles = false,
    disableReminders = false,
    filesBucketName,
    localDatabaseName,
    localFilesBucketName,
    placementRegion,
    productionUrl,
    reminderQueueName,
    turnstileSiteKey,
    workerName,
  }
) {
  const config = parseJsonc(source)

  const updates = [
    [["name"], workerName],
    [["account_id"], accountId],
    [["env", "local", "d1_databases", 0, "database_name"], localDatabaseName],
    [["env", "production", "name"], workerName],
    [["env", "production", "vars", "BETTER_AUTH_URL"], productionUrl],
    [["env", "production", "d1_databases", 0, "database_name"], databaseName],
    [["env", "production", "d1_databases", 0, "database_id"], databaseId],
  ]
  if (turnstileSiteKey !== undefined) {
    updates.push([
      ["env", "production", "vars", "TURNSTILE_SITE_KEY"],
      turnstileSiteKey,
    ])
  }
  const localFiles = (config.env?.local?.r2_buckets ?? []).findIndex(
    (bucket) => bucket.binding === "FILES"
  )
  const productionFiles = (config.env?.production?.r2_buckets ?? []).findIndex(
    (bucket) => bucket.binding === "FILES"
  )
  if (localFilesBucketName !== undefined && localFiles >= 0) {
    updates.push([
      ["env", "local", "r2_buckets", localFiles, "bucket_name"],
      localFilesBucketName,
    ])
  }
  if (disableFiles) {
    updates.push([["env", "production", "r2_buckets"], undefined])
  } else if (filesBucketName !== undefined && productionFiles >= 0) {
    updates.push([
      ["env", "production", "r2_buckets", productionFiles, "bucket_name"],
      filesBucketName,
    ])
  }
  if (disableEmail) {
    // An undefined value removes the property, so the binding is dropped.
    updates.push([["env", "production", "send_email"], undefined])
    updates.push([["env", "production", "vars", "EMAIL_FROM"], ""])
  }
  // Workflow names are unique per account, so each installation owns its own.
  const breakdownWorkflow = (config.env?.production?.workflows ?? []).findIndex(
    (workflow) => workflow.binding === "BREAKDOWN"
  )
  if (breakdownWorkflow >= 0) {
    updates.push([
      ["env", "production", "workflows", breakdownWorkflow, "name"],
      `${workerName}-task-breakdown`,
    ])
  }
  const productionQueues = config.env?.production?.queues
  const reminderProducer = (productionQueues?.producers ?? []).findIndex(
    (producer) => producer.binding === "EMAIL_QUEUE"
  )
  const reminderConsumer = (productionQueues?.consumers ?? []).findIndex(
    (consumer) =>
      consumer.queue === productionQueues?.producers?.[reminderProducer]?.queue
  )
  if (disableReminders) {
    // Without the queue the hourly cron has nothing to do, so it goes too.
    updates.push([["env", "production", "queues"], undefined])
    updates.push([["env", "production", "triggers"], { crons: [] }])
  } else if (reminderQueueName !== undefined && reminderProducer >= 0) {
    updates.push([
      ["env", "production", "queues", "producers", reminderProducer, "queue"],
      reminderQueueName,
    ])
    if (reminderConsumer >= 0) {
      const consumer = ["env", "production", "queues", "consumers"]
      updates.push([
        [...consumer, reminderConsumer, "queue"],
        reminderQueueName,
      ])
      updates.push([
        [...consumer, reminderConsumer, "dead_letter_queue"],
        deadLetterQueueName(reminderQueueName),
      ])
    }
  }
  const updated = updates.reduce(
    (current, [path, value]) => updateJsonc(current, path, value),
    source
  )

  // A placement hint describes where one database's primary lives. A known
  // location sets it; without one, it cannot follow production to a
  // different database.
  const placementPath = ["env", "production", "placement"]
  if (placementRegion !== undefined) {
    return writePlacement(updated, placementPath, placementRegion)
  }
  if (
    config.env?.production?.placement !== undefined &&
    config.env.production.d1_databases?.[0]?.database_id !== databaseId
  ) {
    return writePlacement(updated, placementPath, null)
  }
  return updated
}

/**
 * One line for the installer: where the D1 primary is and the placement
 * production ends up with. `placementRegion` is the resulting hint, or null.
 */
export function placementMessage({ location, placementRegion, requested }) {
  if (requested === "default") {
    return "Placement: default, as --placement asked, so production has no placement hint."
  }
  if (requested) return `Placement: ${requested}, as --placement asked.`

  const primary = location
    ? `The D1 primary is in ${location.colo} (${location.region})`
    : "The D1 primary's location could not be read"
  if (location && placementRegionFor(location) && placementRegion) {
    return `${primary}, so production is placed in ${placementRegion}.`
  }
  const reason = location
    ? `${primary}, which has no known placement region`
    : primary
  return placementRegion
    ? `${reason}; production keeps ${placementRegion}, the hint this database already had.`
    : `${reason}, so production stays on default placement. Run pnpm run placement --env production to set it later.`
}

/** Options for `pnpm run placement`. */
export function parsePlacementArguments(argv) {
  const options = {
    accountId: null,
    environment: null,
    help: false,
    write: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    switch (argument) {
      case "--":
        break
      case "--account-id":
        options.accountId = argv[++index]?.trim() || null
        if (!options.accountId) {
          throw new Error("--account-id needs a Cloudflare account ID.")
        }
        break
      case "--env":
        options.environment = argv[++index]?.trim() || null
        if (!options.environment || options.environment.startsWith("-")) {
          throw new Error(
            "--env needs an environment name, such as production."
          )
        }
        break
      case "--help":
      case "-h":
        options.help = true
        break
      case "--write":
        options.write = true
        break
      default:
        throw new Error(`Unknown option: ${argument}`)
    }
  }

  return options
}

/** Messages that exhaust their retries move to this queue. */
export function deadLetterQueueName(queueName) {
  return `${queueName}-dlq`
}

export function selectDatabase(databases, databaseName, configuredId) {
  if (configuredId) {
    const configured = databases.find(
      (database) => database.uuid === configuredId
    )
    if (configured) return configured
  }

  return databases.find((database) => database.name === databaseName) ?? null
}

export function selectAccount(accounts, requestedId, savedId) {
  const preferredId = requestedId ?? savedId
  if (preferredId) {
    const account = accounts.find((item) => item.id === preferredId)
    if (!account) {
      throw new Error(
        `Cloudflare account ${preferredId} is not available to this login.`
      )
    }
    return account
  }

  if (accounts.length === 1) return accounts[0]
  if (accounts.length === 0) {
    throw new Error("This Cloudflare login has no available accounts.")
  }
  return null
}

export function findDeploymentUrl(output) {
  const matches = output.match(/https:\/\/[^\s]+\.workers\.dev\/?/g)
  if (!matches?.length) return null
  return matches
    .at(-1)
    .replace(/[),.;]+$/, "")
    .replace(/\/$/, "")
}

export function normalizeOrigin(value) {
  const url = new URL(value)
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("The production origin must not include a path or query.")
  }
  return url.origin
}

function quoted(value) {
  return JSON.stringify(value)
}

/**
 * Renames the app in src/lib/site.ts: the name, the short name used in
 * running text, the machine name, and the description. Unset fields keep
 * their values.
 */
export function updateSiteIdentity(source, { name, description, id }) {
  const fields = [
    ["name", name],
    ["shortName", name],
    ["id", id],
    ["description", description],
  ]
  let updated = source
  for (const [field, value] of fields) {
    if (!value) continue
    // Top-level siteConfig fields only, not author.name.
    const pattern = new RegExp(`(^  ${field}:\\s*)"(?:[^"\\\\]|\\\\.)*"`, "m")
    if (!pattern.test(updated)) {
      throw new Error(`Could not find siteConfig.${field} in src/lib/site.ts.`)
    }
    updated = updated.replace(pattern, `$1${quoted(value)}`)
  }
  return updated
}

export function updateSiteOrigin(source, origin) {
  const pattern = /(\borigin:\s*")[^"]+("\s*,)/
  if (!pattern.test(source)) {
    throw new Error("Could not find siteConfig.origin in src/lib/site.ts.")
  }
  return source.replace(pattern, `$1${normalizeOrigin(origin)}$2`)
}

/**
 * A configured production site key requires TURNSTILE_SECRET_KEY on the
 * Worker, or auth fails closed. When the secret is absent (a fresh fork that
 * inherited the template's key), disable the challenge instead.
 */
export function resolveTurnstileSiteKey(configuredSiteKey, secretList) {
  if (!configuredSiteKey) return ""
  return hasSecret(secretList, "TURNSTILE_SECRET_KEY") ? configuredSiteKey : ""
}

/** Wrangler reports code 10042 until R2 is enabled for the account. */
export function r2Unavailable(output) {
  return /\b10042\b|enable R2/i.test(output)
}

export function emailDomain(address) {
  const match = /^[^\s@<>]+@([^\s@<>]+\.[^\s@<>]+)$/.exec(address ?? "")
  return match ? match[1].toLowerCase() : null
}

/**
 * Reads `wrangler email sending list` table output and reports whether the
 * named sending domain is present and enabled. Wrangler has no JSON output
 * for this command.
 */
export function sendingDomainEnabled(listOutput, domain) {
  return listOutput.split("\n").some((line) => {
    const cells = line
      .split("│")
      .map((cell) => cell.trim().toLowerCase())
      .filter(Boolean)
    return cells.includes(domain.toLowerCase()) && cells.includes("yes")
  })
}

export function hasSecret(secretList, name) {
  return Array.isArray(secretList)
    ? secretList.some((secret) => secret.name === name)
    : false
}

export function mergeSetupState(current, update) {
  return {
    schemaVersion: setupStateVersion,
    ...current,
    ...update,
  }
}
