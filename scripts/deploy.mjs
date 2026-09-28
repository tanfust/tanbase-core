import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { isUpstreamRemote, originUrl } from "./deploy-guard.mjs"
import {
  deployResources,
  filesBucketName,
  isTopLevelBuild,
  parseConfig,
  prepareDatabase,
  prepareFiles,
  resolveWorkerName,
  secretCheckWarning,
  secretStatus,
  shouldCreateSecret,
  withFilesBinding,
} from "./deploy-resources.mjs"

// `pnpm run deploy` deploys the top-level Wrangler configuration, as the
// Deploy to Cloudflare button does after `pnpm run build`, and as a
// repository imported from the dashboard needs for its deploy command
// (ADR-0021). It builds when there is no top-level build, creates the D1
// database when it is missing, binds R2 when the account has it, applies
// migrations, and deploys, creating BETTER_AUTH_SECRET on the first deploy.
// TanBase's own production deploys with `pnpm cf:deploy:production` instead.
if (isUpstreamRemote(originUrl())) {
  console.error(
    "Refusing to deploy: this is the upstream TanBase checkout, where the " +
      "top-level configuration would replace the demo's production Worker. " +
      "Production deploys from Workers Builds with `pnpm cf:deploy:production`. " +
      "Deploying to your own account? Push this checkout to your own " +
      "repository first, or use `pnpm run setup`."
  )
  process.exit(1)
}

// Only the top level is deployed here, so no command may target another
// environment, including the build and Wrangler's config checks.
delete process.env.CLOUDFLARE_ENV

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const log = (line) => console.log(line)

function stop(message) {
  console.error(`\nDeploy stopped: ${message}`)
  process.exit(1)
}

function run(args) {
  const result = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    stdio: "inherit",
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function capture(args) {
  const result = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
  })
  const stdout = result.stdout ?? ""
  return {
    status: result.status ?? 1,
    stdout,
    output: `${stdout}\n${result.stderr ?? ""}`.trim(),
  }
}

// `vite build` writes the configuration `wrangler deploy` uses and points
// Wrangler's redirect, .wrangler/deploy/config.json, at it.
function readGeneratedConfig() {
  const redirect = join(root, ".wrangler", "deploy", "config.json")
  try {
    const { configPath } = JSON.parse(readFileSync(redirect, "utf8"))
    const path = resolve(dirname(redirect), configPath)
    if (!existsSync(path)) return null
    const config = parseConfig(readFileSync(path, "utf8"), path)
    return isTopLevelBuild(config) ? { path, config } : null
  } catch {
    return null
  }
}

let generated = readGeneratedConfig()
if (!generated) {
  // A dashboard import's build command is blank by default, and a build of
  // another environment must not be deployed as the top level.
  log("Building the top-level configuration.")
  const built = spawnSync("pnpm", ["run", "build"], { stdio: "inherit" })
  if (built.status !== 0) process.exit(built.status ?? 1)
  generated = readGeneratedConfig()
  if (!generated) stop("the build wrote no top-level Wrangler configuration.")
}

const resources = deployResources(
  readFileSync(join(root, "wrangler.jsonc"), "utf8")
)
const worker = resolveWorkerName({
  override: process.env.WRANGLER_CI_OVERRIDE_NAME,
  built: generated.config.name,
  config: resources.name,
})

try {
  prepareDatabase(resources.database, capture, log)
} catch (error) {
  stop(error instanceof Error ? error.message : String(error))
}

// Only the optional FILES binding is written into the generated file; the
// rest is exactly what the build produced.
const bucket = prepareFiles(
  resources.bucket?.name ?? filesBucketName(worker),
  capture,
  log
)
writeFileSync(
  generated.path,
  JSON.stringify(withFilesBinding(generated.config, bucket))
)

run(["d1", "migrations", "apply", "DB", "--remote"])

// The same name for the check and the deploy: a secret created for one
// Worker must never land on another.
const secret = secretStatus(
  capture(["secret", "list", "--format", "json", "--name", worker])
)
if (secret === "unknown") log(secretCheckWarning)

const args = ["deploy", "--name", worker]
let temporary = null
let status = 1
try {
  if (shouldCreateSecret(secret)) {
    temporary = mkdtempSync(join(tmpdir(), "tanbase-deploy-"))
    const secretsPath = join(temporary, "secrets.json")
    writeFileSync(
      secretsPath,
      `${JSON.stringify({ BETTER_AUTH_SECRET: randomBytes(32).toString("base64url") })}\n`,
      { mode: 0o600 }
    )
    chmodSync(secretsPath, 0o600)
    args.push("--secrets-file", secretsPath)
  }
  status =
    spawnSync("pnpm", ["exec", "wrangler", ...args], { stdio: "inherit" })
      .status ?? 1
} finally {
  if (temporary) rmSync(temporary, { force: true, recursive: true })
}
if (status !== 0) process.exit(status)

log(
  bucket
    ? `Attachments: on, in the R2 bucket ${bucket}.`
    : "Attachments: off until R2 is enabled; redeploy after enabling it."
)
log(
  shouldCreateSecret(secret)
    ? "BETTER_AUTH_SECRET: created for this Worker and stored only in Cloudflare."
    : secret === "present"
      ? "BETTER_AUTH_SECRET: kept."
      : "BETTER_AUTH_SECRET: not checked."
)
