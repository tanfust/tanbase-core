#!/usr/bin/env node

import { randomBytes } from "node:crypto"
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

import {
  deriveWorkerName,
  deadLetterQueueName,
  emailDomain,
  findDeploymentUrl,
  hasSecret,
  localTurnstileTestSecret,
  mergeSetupState,
  normalizeOrigin,
  parseArguments,
  r2Unavailable,
  readWranglerInstallation,
  resolveTurnstileSiteKey,
  selectAccount,
  selectDatabase,
  sendingDomainEnabled,
  setupPlan,
  updateLlmsOrigin,
  updateSiteOrigin,
  updateWranglerInstallation,
} from "./setup/core.mjs"
import {
  commandAvailable,
  packageManager,
  run,
  runPnpm,
  runWrangler,
} from "./setup/runner.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const configPath = join(root, "wrangler.jsonc")
const sitePath = join(root, "src/lib/site.ts")
const llmsPath = join(root, "src/modules/seo/llms.txt")
const localSecretsPath = join(root, ".dev.vars")
const stateDirectory = join(root, ".tanbase")
const statePath = join(stateDirectory, "setup-state.json")

function heading(message) {
  process.stdout.write(`\n${message}\n`)
}

function help() {
  process.stdout.write(`TanBase guided setup

Usage:
  pnpm run setup [options]

Options:
  --account-id <id>   Select a Cloudflare account when the login has several
  --name <name>       Worker name (default: repository directory name)
  --reuse-existing    Reuse same-named Worker and D1 resources intentionally
  --local-only        Prepare local development without Cloudflare changes
  --yes, -y           Accept safe defaults without the initial confirmation
  --dry-run           Print the plan without changing local or remote state
  --help, -h          Show this help

Email Service, custom domains, Git integration, previews, and future optional
Cloudflare modules are skipped. Setup never deletes remote resources.
`)
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    if (error?.code === "ENOENT") return null
    throw error
  }
}

async function writeAtomic(path, value, options) {
  const temporaryPath = `${path}.setup-${process.pid}`
  await writeFile(temporaryPath, value, options)
  await rename(temporaryPath, path)
}

async function confirm(question, defaultValue, nonInteractive) {
  if (nonInteractive) return defaultValue
  const prompt = defaultValue ? " [Y/n] " : " [y/N] "
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  try {
    const answer = (await readline.question(`${question}${prompt}`))
      .trim()
      .toLowerCase()
    if (!answer) return defaultValue
    return answer === "y" || answer === "yes"
  } finally {
    readline.close()
  }
}

async function chooseAccount(accounts, requestedId, savedId, nonInteractive) {
  const selected = selectAccount(accounts, requestedId, savedId)
  if (selected) return selected
  if (nonInteractive) {
    throw new Error(
      "This login has multiple Cloudflare accounts. Run again with --account-id <id>."
    )
  }

  heading("Choose the Cloudflare account for TanBase:")
  accounts.forEach((account, index) => {
    process.stdout.write(`  ${index + 1}. ${account.name} (${account.id})\n`)
  })
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  try {
    const answer = await readline.question("Account number: ")
    const account = accounts[Number(answer) - 1]
    if (!account) throw new Error("That account number is not valid.")
    return account
  } finally {
    readline.close()
  }
}

async function authenticate(manager) {
  let identity = await runWrangler(manager, ["whoami", "--json"], {
    allowFailure: true,
    capture: true,
    cwd: root,
    echo: false,
  })
  if (identity.code !== 0) {
    heading("Cloudflare authorization")
    process.stdout.write(
      "Your browser will open so you can approve this installation.\n"
    )
    await runWrangler(manager, ["login"], { cwd: root })
    identity = await runWrangler(manager, ["whoami", "--json"], {
      capture: true,
      cwd: root,
      echo: false,
    })
  }
  return JSON.parse(identity.output)
}

async function ensureLocalSecret() {
  let source = ""
  try {
    source = await readFile(localSecretsPath, "utf8")
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }

  const missing = []
  if (!/^BETTER_AUTH_SECRET\s*=/m.test(source)) {
    missing.push(`BETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}`)
  }
  if (!/^TURNSTILE_SECRET_KEY\s*=/m.test(source)) {
    missing.push(`TURNSTILE_SECRET_KEY=${localTurnstileTestSecret}`)
  }
  if (missing.length === 0) return

  const separator = source && !source.endsWith("\n") ? "\n" : ""
  await writeAtomic(
    localSecretsPath,
    `${source}${separator}${missing.join("\n")}\n`,
    { mode: 0o600 }
  )
  await chmod(localSecretsPath, 0o600)
}

async function remoteWorkerExists(manager, workerName, accountEnv) {
  const result = await runWrangler(
    manager,
    ["deployments", "list", "--name", workerName, "--json"],
    {
      allowFailure: true,
      capture: true,
      cwd: root,
      echo: false,
      env: accountEnv,
    }
  )
  if (result.code !== 0) return false
  try {
    const deployments = JSON.parse(result.output)
    return Array.isArray(deployments) && deployments.length > 0
  } catch {
    return false
  }
}

async function ensureDatabase({
  accountEnv,
  databaseName,
  expectedDatabaseId,
  manager,
  nonInteractive,
  reuseExisting,
}) {
  const listDatabases = async () => {
    const result = await runWrangler(manager, ["d1", "list", "--json"], {
      capture: true,
      cwd: root,
      echo: false,
      env: accountEnv,
    })
    return JSON.parse(result.output)
  }

  let databases = await listDatabases()
  let database = selectDatabase(databases, databaseName, expectedDatabaseId)
  const isRecordedDatabase = database?.uuid === expectedDatabaseId

  if (database && !isRecordedDatabase && !reuseExisting) {
    const approved = await confirm(
      `A D1 database named ${database.name} already exists. Reuse it?`,
      false,
      nonInteractive
    )
    if (!approved) {
      throw new Error(
        "Setup stopped before touching the existing database. Use --name for a separate installation or --reuse-existing to reuse it."
      )
    }
  }

  if (!database) {
    heading("Creating the production D1 database")
    await runWrangler(manager, ["d1", "create", databaseName], {
      cwd: root,
      env: accountEnv,
    })
    databases = await listDatabases()
    database = selectDatabase(databases, databaseName, null)
  }

  if (!database?.uuid) {
    throw new Error(
      "Cloudflare created the database but its ID could not be resolved."
    )
  }
  return database
}

// Returns the bucket name when it exists or was created, or null when R2 is
// not enabled for the account, in which case attachments are turned off.
async function ensureFilesBucket({
  accountEnv,
  bucketName,
  manager,
  nonInteractive,
  recorded,
  reuseExisting,
}) {
  const info = await runWrangler(
    manager,
    ["r2", "bucket", "info", bucketName, "--json"],
    {
      allowFailure: true,
      capture: true,
      cwd: root,
      echo: false,
      env: accountEnv,
    }
  )
  const infoOutput = `${info.output}\n${info.errorOutput}`
  if (r2Unavailable(infoOutput)) return null

  if (info.code === 0) {
    if (!recorded && !reuseExisting) {
      const approved = await confirm(
        `An R2 bucket named ${bucketName} already exists. Reuse it?`,
        false,
        nonInteractive
      )
      if (!approved) {
        throw new Error(
          "Setup stopped before touching the existing bucket. Use --name for a separate installation or --reuse-existing to reuse it."
        )
      }
    }
    return bucketName
  }

  heading("Creating the production R2 bucket")
  const created = await runWrangler(
    manager,
    ["r2", "bucket", "create", bucketName],
    {
      allowFailure: true,
      capture: true,
      cwd: root,
      env: accountEnv,
    }
  )
  if (created.code === 0) return bucketName
  if (r2Unavailable(`${created.output}\n${created.errorOutput}`)) return null
  throw new Error(`Cloudflare did not create the R2 bucket ${bucketName}.`)
}

// Returns the reminder queue name once it and its dead-letter queue exist, or
// null when the operator continues without reminders after a failed create.
async function ensureReminderQueues({
  accountEnv,
  manager,
  nonInteractive,
  queueName,
  recorded,
  reuseExisting,
}) {
  for (const name of [queueName, deadLetterQueueName(queueName)]) {
    const info = await runWrangler(manager, ["queues", "info", name], {
      allowFailure: true,
      capture: true,
      cwd: root,
      echo: false,
      env: accountEnv,
    })
    if (info.code === 0) {
      if (!recorded && !reuseExisting) {
        const approved = await confirm(
          `A queue named ${name} already exists. Reuse it?`,
          false,
          nonInteractive
        )
        if (!approved) {
          throw new Error(
            "Setup stopped before touching the existing queue. Use --name for a separate installation or --reuse-existing to reuse it."
          )
        }
      }
      continue
    }

    heading(`Creating the ${name} queue`)
    const created = await runWrangler(manager, ["queues", "create", name], {
      allowFailure: true,
      capture: true,
      cwd: root,
      env: accountEnv,
    })
    if (created.code === 0) continue

    process.stderr.write(`${created.errorOutput || created.output}\n`)
    const withoutReminders = await confirm(
      "Cloudflare did not create the queue. Continue without due-date reminders?",
      false,
      nonInteractive
    )
    if (withoutReminders) return null
    throw new Error(`Cloudflare did not create the queue ${name}.`)
  }
  return queueName
}

// Lists production secret names (never values). A missing Worker has none.
async function remoteSecretList(manager, accountEnv) {
  const result = await runWrangler(
    manager,
    ["secret", "list", "--env", "production", "--format", "json"],
    {
      allowFailure: true,
      capture: true,
      cwd: root,
      echo: false,
      env: accountEnv,
    }
  )
  if (result.code !== 0) return []
  try {
    return JSON.parse(result.output)
  } catch {
    return []
  }
}

// The production EMAIL binding fails to deploy on accounts without Email
// Sending, so keep the sender only when its domain is onboarded and enabled.
async function readyEmailSender(manager, accountEnv, sender) {
  const domain = emailDomain(sender)
  if (!domain) return null
  const result = await runWrangler(manager, ["email", "sending", "list"], {
    allowFailure: true,
    capture: true,
    cwd: root,
    echo: false,
    env: accountEnv,
  })
  if (result.code !== 0) return null
  return sendingDomainEnabled(result.output, domain) ? sender : null
}

async function hasRemoteAuthSecret(manager, accountEnv) {
  return hasSecret(
    await remoteSecretList(manager, accountEnv),
    "BETTER_AUTH_SECRET"
  )
}

async function deploy(manager, accountEnv, configureSecret) {
  let temporaryDirectory = null
  try {
    const args = ["deploy"]
    if (configureSecret) {
      temporaryDirectory = await mkdtemp(join(tmpdir(), "tanbase-setup-"))
      const secretsPath = join(temporaryDirectory, "secrets.json")
      await writeFile(
        secretsPath,
        `${JSON.stringify({
          BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
        })}\n`,
        { mode: 0o600 }
      )
      await chmod(secretsPath, 0o600)
      args.push("--secrets-file", secretsPath)
    }

    return await runWrangler(manager, args, {
      capture: true,
      cwd: root,
      env: accountEnv,
    })
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { force: true, recursive: true })
    }
  }
}

async function main() {
  const state = (await readJson(statePath)) ?? {}
  let turnstileEnabled = false
  let emailSender = null
  const argv = process.argv.slice(2)
  const explicitlyNamed = argv.includes("--name")
  const defaultWorkerName = explicitlyNamed
    ? deriveWorkerName(basename(root))
    : (state.workerName ?? deriveWorkerName(basename(root)))
  const options = parseArguments(argv, defaultWorkerName)

  if (options.help) {
    help()
    return
  }

  heading("TanBase setup")
  const plan = setupPlan(options)
  process.stdout.write(
    `${plan.map((step, index) => `  ${index + 1}. ${step}`).join("\n")}\n`
  )
  process.stdout.write(
    "\nSkipped: Email Service onboarding, custom domains, Git integration, previews, and future optional modules.\n"
  )
  if (options.dryRun) return

  const approved = await confirm(
    options.localOnly
      ? "Prepare this clone for local development?"
      : "Create the required Cloudflare resources and deploy TanBase?",
    true,
    options.yes
  )
  if (!approved) {
    process.stdout.write("Setup cancelled without making changes.\n")
    return
  }

  const [major, minor] = process.versions.node.split(".").map(Number)
  const supported = (major === 22 && minor >= 13) || major === 23 || major >= 24
  if (!supported) {
    throw new Error("TanBase requires Node.js 22.13+ or 24+.")
  }

  const manager = packageManager()
  if (!commandAvailable(join(root, "node_modules", ".bin", "wrangler"))) {
    heading("Installing locked dependencies")
    await runPnpm(manager, ["install", "--frozen-lockfile"], { cwd: root })
  }

  if (options.localOnly) {
    heading("Preparing local development")
    await ensureLocalSecret()
    await runPnpm(manager, ["db:migrate:local"], { cwd: root })
    await runPnpm(manager, ["db:seed:local"], { cwd: root })
    await runPnpm(manager, ["cf:typegen"], { cwd: root })
    await runPnpm(manager, ["verify"], { cwd: root })
    heading("TanBase local setup is complete")
    process.stdout.write("Run pnpm dev and open http://localhost:3000.\n")
    return
  }

  const managerIdentity = await authenticate(manager)
  const account = await chooseAccount(
    managerIdentity.accounts,
    options.accountId,
    state.accountId,
    options.yes
  )
  const accountEnv = {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: account.id,
  }
  const workerName = options.workerName
  const sameInstallation =
    state.accountId === account.id && state.workerName === workerName

  if (
    !sameInstallation &&
    (await remoteWorkerExists(manager, workerName, accountEnv)) &&
    !options.reuseExisting
  ) {
    const approvedExisting = await confirm(
      `A Worker named ${workerName} already exists. Reuse and update it?`,
      false,
      options.yes
    )
    if (!approvedExisting) {
      throw new Error(
        "Setup stopped before changing the existing Worker. Use --name for a separate installation or --reuse-existing to update it."
      )
    }
  }

  const originalConfig = await readFile(configPath, "utf8")
  const configured = readWranglerInstallation(originalConfig)
  const databaseName = `${workerName}-production`
  const localDatabaseName = `${workerName}-local`
  const configurationMatches =
    configured.accountId === account.id &&
    configured.workerName === workerName &&
    configured.databaseName === databaseName
  const expectedDatabaseId = sameInstallation
    ? state.databaseId
    : configurationMatches
      ? configured.databaseId
      : null
  const database = await ensureDatabase({
    accountEnv,
    databaseName,
    expectedDatabaseId,
    manager,
    nonInteractive: options.yes,
    reuseExisting: options.reuseExisting,
  })

  const desiredBucketName = `${workerName}-files`
  const filesBucket = await ensureFilesBucket({
    accountEnv,
    bucketName: desiredBucketName,
    manager,
    nonInteractive: options.yes,
    recorded: sameInstallation && state.filesBucket === desiredBucketName,
    reuseExisting: options.reuseExisting,
  })

  const desiredQueueName = `${workerName}-email`
  const reminderQueue = await ensureReminderQueues({
    accountEnv,
    manager,
    nonInteractive: options.yes,
    queueName: desiredQueueName,
    recorded: sameInstallation && state.reminderQueue === desiredQueueName,
    reuseExisting: options.reuseExisting,
  })

  let currentState = mergeSetupState(state, {
    accountId: account.id,
    accountName: account.name,
    databaseId: database.uuid,
    databaseName,
    emailSetup: "skipped",
    filesBucket: filesBucket ?? "unavailable",
    reminderQueue: reminderQueue ?? "unavailable",
    optionalModules: "skipped",
    workerName,
  })
  await mkdir(stateDirectory, { recursive: true })
  const saveState = async (update) => {
    currentState = mergeSetupState(currentState, update)
    await writeAtomic(statePath, `${JSON.stringify(currentState, null, 2)}\n`, {
      mode: 0o600,
    })
  }

  const provisionalOrigin =
    sameInstallation && state.url
      ? normalizeOrigin(state.url)
      : `https://${workerName}.workers.dev`
  const configuredSource = updateWranglerInstallation(originalConfig, {
    accountId: account.id,
    databaseId: database.uuid,
    databaseName,
    disableFiles: filesBucket === null,
    disableReminders: reminderQueue === null,
    filesBucketName: filesBucket ?? undefined,
    localDatabaseName,
    localFilesBucketName: `${workerName}-files-local`,
    productionUrl: provisionalOrigin,
    reminderQueueName: reminderQueue ?? undefined,
    workerName,
  })
  await writeAtomic(configPath, configuredSource)
  await writeAtomic(
    sitePath,
    updateSiteOrigin(await readFile(sitePath, "utf8"), provisionalOrigin)
  )
  await writeAtomic(
    llmsPath,
    updateLlmsOrigin(await readFile(llmsPath, "utf8"), provisionalOrigin)
  )

  // Checked after the Worker name is written, so the lookups target this
  // installation rather than the template's Worker and sender.
  const installation = readWranglerInstallation(configuredSource)
  const turnstileSiteKey = resolveTurnstileSiteKey(
    installation.turnstileSiteKey,
    await remoteSecretList(manager, accountEnv)
  )
  emailSender = installation.emailFrom
    ? await readyEmailSender(manager, accountEnv, installation.emailFrom)
    : null
  const disableEmail = Boolean(installation.emailFrom) && !emailSender
  if (
    turnstileSiteKey !== (installation.turnstileSiteKey ?? "") ||
    disableEmail
  ) {
    await writeAtomic(
      configPath,
      updateWranglerInstallation(configuredSource, {
        accountId: account.id,
        databaseId: database.uuid,
        databaseName,
        disableEmail,
        localDatabaseName,
        productionUrl: provisionalOrigin,
        turnstileSiteKey,
        workerName,
      })
    )
  }
  turnstileEnabled = turnstileSiteKey !== ""

  await saveState({
    completedSteps: ["cloudflare-account", "d1", "configuration"],
  })

  heading("Preparing and verifying TanBase")
  await ensureLocalSecret()
  await runPnpm(manager, ["db:migrate:local"], { cwd: root })
  await runPnpm(manager, ["db:seed:local"], { cwd: root })
  await runPnpm(manager, ["cf:typegen"], { cwd: root })
  await runPnpm(manager, ["verify"], { cwd: root })
  await runPnpm(manager, ["cf:dry-run:production"], {
    cwd: root,
    env: accountEnv,
  })

  heading("Applying production migrations")
  await runPnpm(manager, ["db:migrate:production"], {
    cwd: root,
    env: { ...accountEnv, CI: "true" },
  })
  await saveState({
    completedSteps: [
      "cloudflare-account",
      "d1",
      "configuration",
      "local",
      "verification",
      "production-migrations",
    ],
  })

  const secretConfigured = await hasRemoteAuthSecret(manager, accountEnv)
  heading("Deploying TanBase")
  await runPnpm(manager, ["cf:build:production"], {
    cwd: root,
    env: accountEnv,
  })
  let deployment = await deploy(manager, accountEnv, !secretConfigured)
  let deploymentUrl =
    findDeploymentUrl(`${deployment.output}\n${deployment.errorOutput}`) ??
    state.url ??
    null
  if (!deploymentUrl) {
    throw new Error("Wrangler deployed the Worker but did not report its URL.")
  }
  deploymentUrl = normalizeOrigin(deploymentUrl)

  if (deploymentUrl !== provisionalOrigin) {
    heading("Reconciling the final workers.dev URL")
    await writeAtomic(
      configPath,
      updateWranglerInstallation(await readFile(configPath, "utf8"), {
        accountId: account.id,
        databaseId: database.uuid,
        databaseName,
        localDatabaseName,
        productionUrl: deploymentUrl,
        workerName,
      })
    )
    await writeAtomic(
      sitePath,
      updateSiteOrigin(await readFile(sitePath, "utf8"), deploymentUrl)
    )
    await writeAtomic(
      llmsPath,
      updateLlmsOrigin(await readFile(llmsPath, "utf8"), deploymentUrl)
    )
    await runPnpm(manager, ["cf:typegen"], { cwd: root })
    await runPnpm(manager, ["verify"], { cwd: root })
    await runPnpm(manager, ["cf:dry-run:production"], {
      cwd: root,
      env: accountEnv,
    })
    await runPnpm(manager, ["cf:build:production"], {
      cwd: root,
      env: accountEnv,
    })
    deployment = await deploy(manager, accountEnv, false)
    deploymentUrl =
      findDeploymentUrl(`${deployment.output}\n${deployment.errorOutput}`) ??
      deploymentUrl
  }

  heading("Verifying the production deployment")
  await runPnpm(
    manager,
    ["smoke", "--", "--url", deploymentUrl, "--environment", "production"],
    { cwd: root }
  )
  await runWrangler(
    manager,
    ["d1", "migrations", "list", "DB", "--env", "production", "--remote"],
    { cwd: root, env: accountEnv }
  )

  const commit = await run("git", ["rev-parse", "HEAD"], {
    allowFailure: true,
    capture: true,
    cwd: root,
    echo: false,
  })
  await saveState({
    authSecretConfigured: true,
    completedSteps: [
      "cloudflare-account",
      "d1",
      "configuration",
      "local",
      "verification",
      "production-migrations",
      "deployment",
      "production-smoke",
    ],
    sourceCommit: commit.code === 0 ? commit.output.trim() : null,
    updatedAt: new Date().toISOString(),
    url: deploymentUrl,
  })

  heading("TanBase is ready")
  process.stdout.write(`App: ${deploymentUrl}\n`)
  process.stdout.write(`D1: ${database.name} (${database.uuid})\n`)
  process.stdout.write(
    "Better Auth secret: configured in Cloudflare and not stored locally.\n"
  )
  process.stdout.write(
    turnstileEnabled
      ? "Turnstile: enabled with the existing TURNSTILE_SECRET_KEY Worker secret.\n"
      : "Turnstile: disabled. Auth forms have no bot challenge until you create a widget, set TURNSTILE_SECRET_KEY, and commit its site key (docs/DEPLOYMENT.md).\n"
  )
  process.stdout.write(
    filesBucket
      ? `Attachments: stored in the R2 bucket ${filesBucket}.\n`
      : "Attachments: off. Enable R2 in the Cloudflare dashboard, then run setup again to create the bucket (docs/DEPLOYMENT.md).\n"
  )
  process.stdout.write(
    reminderQueue
      ? `Reminders: hourly, through the ${reminderQueue} queue.\n`
      : "Reminders: off. Create the queues, then run setup again to restore them (docs/DEPLOYMENT.md).\n"
  )
  process.stdout.write(
    emailSender
      ? `Email: sending from ${emailSender} through the EMAIL binding.\n`
      : "Email: disabled. Delivery is logged as metadata until you onboard an Email Sending domain and restore the EMAIL binding (docs/DEPLOYMENT.md).\n"
  )
  process.stdout.write(
    "Optional services: skipped. Configure a custom domain and Git deployment only when needed.\n"
  )
  process.stdout.write(
    "Review and commit wrangler.jsonc, generated Worker types, and the canonical URL changes for future Cloudflare Builds.\n"
  )
}

main().catch((error) => {
  process.stderr.write(
    `\nSetup stopped: ${error instanceof Error ? error.message : String(error)}\n`
  )
  process.stderr.write(
    "Nothing was deleted. Completed resources and non-secret checkpoints are preserved; fix the message and run the same command again.\n"
  )
  process.exitCode = 1
})
