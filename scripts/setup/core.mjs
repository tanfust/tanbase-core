import { applyEdits, modify, parse } from "jsonc-parser"

export const setupStateVersion = 1

// Cloudflare's documented always-pass Turnstile test secret. It pairs with the
// local test site key in wrangler.jsonc and is not a credential.
export const localTurnstileTestSecret = "1x0000000000000000000000000000000AA"

const workerNamePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

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
    dryRun: false,
    help: false,
    localOnly: false,
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

  return options
}

export function setupPlan({ localOnly }) {
  const localSteps = [
    "Create local-only Better Auth and Turnstile test secrets when missing",
    "Apply and seed the isolated local D1 database",
  ]

  if (localOnly) {
    return [
      "Install locked dependencies",
      ...localSteps,
      "Regenerate Worker types and run pnpm verify",
    ]
  }

  return [
    "Install locked dependencies",
    "Authorize and select a Cloudflare account",
    "Create or safely reuse the production Worker and D1 database",
    "Create or safely reuse the production R2 bucket, or turn attachments off when R2 is not enabled",
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

function updateJsonc(source, path, value) {
  const edits = modify(source, path, value, {
    formattingOptions: { eol: "\n", insertSpaces: true, tabSize: 2 },
  })
  return applyEdits(source, edits)
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
    productionUrl: production?.vars?.BETTER_AUTH_URL ?? null,
    turnstileSiteKey: production?.vars?.TURNSTILE_SITE_KEY ?? null,
    workerName: production?.name ?? config.name ?? null,
  }
}

export function updateWranglerInstallation(
  source,
  {
    accountId,
    databaseId,
    databaseName,
    disableEmail = false,
    disableFiles = false,
    filesBucketName,
    localDatabaseName,
    localFilesBucketName,
    productionUrl,
    turnstileSiteKey,
    workerName,
  }
) {
  const config = parseJsonc(source)

  const updates = [
    [["name"], workerName],
    [["account_id"], accountId],
    [["d1_databases", 0, "database_name"], localDatabaseName],
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
  const localFiles = (config.r2_buckets ?? []).findIndex(
    (bucket) => bucket.binding === "FILES"
  )
  const productionFiles = (config.env?.production?.r2_buckets ?? []).findIndex(
    (bucket) => bucket.binding === "FILES"
  )
  if (localFilesBucketName !== undefined && localFiles >= 0) {
    updates.push([
      ["r2_buckets", localFiles, "bucket_name"],
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

  return updates.reduce(
    (updated, [path, value]) => updateJsonc(updated, path, value),
    source
  )
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

export function updateSiteOrigin(source, origin) {
  const pattern = /(\borigin:\s*")[^"]+("\s*,)/
  if (!pattern.test(source)) {
    throw new Error("Could not find siteConfig.origin in src/lib/site.ts.")
  }
  return source.replace(pattern, `$1${normalizeOrigin(origin)}$2`)
}

export function updateLlmsOrigin(source, origin) {
  const pattern = /^- Production origin: https?:\/\/\S+$/m
  if (!pattern.test(source)) {
    throw new Error("Could not find the production origin in llms.txt.")
  }
  return source.replace(
    pattern,
    `- Production origin: ${normalizeOrigin(origin)}/`
  )
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
