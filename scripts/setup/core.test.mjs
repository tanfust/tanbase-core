import assert from "node:assert/strict"
import test from "node:test"

import {
  deriveWorkerName,
  findDeploymentUrl,
  hasSecret,
  mergeSetupState,
  normalizeOrigin,
  parseArguments,
  readWranglerInstallation,
  selectAccount,
  selectDatabase,
  setupPlan,
  updateLlmsOrigin,
  updateSiteOrigin,
  updateWranglerInstallation,
} from "./core.mjs"
import { run } from "./runner.mjs"

const config = `{
  // Local development stays isolated.
  "name": "tanbase-core",
  "vars": { "APP_ENV": "local" },
  "d1_databases": [
    { "binding": "DB", "database_name": "tanbase-core-local" },
  ],
  "send_email": [{ "name": "EMAIL" }],
  "env": {
    "production": {
      "name": "tanbase-core",
      "vars": {
        "APP_ENV": "production",
        "BETTER_AUTH_URL": "https://old.example.com",
        "EMAIL_FROM": "sender@example.com",
      },
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "tanbase-core-production",
          "database_id": "old-database",
        },
      ],
      "send_email": [{ "name": "EMAIL" }],
    },
  },
}
`

test("derives a valid default Worker name from a directory", () => {
  assert.equal(deriveWorkerName("My Product!!"), "my-product")
  assert.equal(deriveWorkerName("---"), "tanbase-core")
  assert.ok(deriveWorkerName("a".repeat(80)).length <= 63)
})

test("parses setup arguments with remote setup defaults", () => {
  assert.deepEqual(parseArguments([], "my-app"), {
    accountId: null,
    dryRun: false,
    help: false,
    localOnly: false,
    reuseExisting: false,
    workerName: "my-app",
    yes: false,
  })
})

test("parses explicit safe automation options", () => {
  assert.deepEqual(
    parseArguments([
      "--yes",
      "--name",
      "customer-app",
      "--account-id",
      "account-1",
      "--reuse-existing",
    ]),
    {
      accountId: "account-1",
      dryRun: false,
      help: false,
      localOnly: false,
      reuseExisting: true,
      workerName: "customer-app",
      yes: true,
    }
  )
})

test("accepts the argument separator forwarded by package managers", () => {
  assert.equal(parseArguments(["--", "--dry-run"]).dryRun, true)
})

test("rejects ambiguous or invalid argument combinations", () => {
  assert.throws(() => parseArguments(["--name", "Bad Name"]))
  assert.throws(() => parseArguments(["--unknown"]))
  assert.throws(() =>
    parseArguments(["--local-only", "--account-id", "account-1"])
  )
})

test("local-only plan contains no remote mutation", () => {
  const plan = setupPlan({ localOnly: true }).join(" ")
  assert.doesNotMatch(plan, /deploy|production migrations|Cloudflare account/i)
  assert.match(plan, /local D1/i)
})

test("remote plan applies migrations before deployment", () => {
  const plan = setupPlan({ localOnly: false })
  assert.ok(
    plan.findIndex((step) => step.includes("production migrations")) <
      plan.findIndex((step) => step.startsWith("Deploy"))
  )
})

test("updates only the intended local and production Wrangler fields", () => {
  const updated = updateWranglerInstallation(config, {
    accountId: "account-1",
    databaseId: "database-1",
    databaseName: "customer-app-production",
    localDatabaseName: "customer-app-local",
    productionUrl: "https://customer-app.owner.workers.dev",
    workerName: "customer-app",
  })
  const installation = readWranglerInstallation(updated)

  assert.deepEqual(installation, {
    accountId: "account-1",
    databaseId: "database-1",
    databaseName: "customer-app-production",
    productionUrl: "https://customer-app.owner.workers.dev",
    workerName: "customer-app",
  })
  assert.match(updated, /"database_name": "customer-app-local"/)
  assert.equal(updated.match(/send_email/g)?.length, 2)
  assert.match(updated, /sender@example\.com/)
  assert.match(updated, /Local development stays isolated/)
})

test("database selection prefers the recorded id and otherwise uses the name", () => {
  const databases = [
    { name: "customer-app-production", uuid: "one" },
    { name: "other", uuid: "two" },
  ]
  assert.equal(
    selectDatabase(databases, "customer-app-production", "two")?.name,
    "other"
  )
  assert.equal(
    selectDatabase(databases, "customer-app-production", null)?.uuid,
    "one"
  )
  assert.equal(selectDatabase(databases, "missing", null), null)
})

test("account selection respects explicit and saved account ids", () => {
  const accounts = [
    { id: "one", name: "One" },
    { id: "two", name: "Two" },
  ]
  assert.equal(selectAccount(accounts, "two", "one")?.name, "Two")
  assert.equal(selectAccount(accounts, null, "one")?.name, "One")
  assert.equal(selectAccount(accounts, null, null), null)
  assert.throws(() => selectAccount(accounts, "missing", null))
})

test("deployment URL parser returns the final workers.dev URL", () => {
  assert.equal(
    findDeploymentUrl(
      "Uploaded old\nhttps://old.owner.workers.dev\nDeployed\nhttps://final.owner.workers.dev/\n"
    ),
    "https://final.owner.workers.dev"
  )
  assert.equal(findDeploymentUrl("no deployment url"), null)
})

test("canonical origin helpers reject paths and update both sources", () => {
  assert.equal(
    normalizeOrigin("https://customer-app.owner.workers.dev/"),
    "https://customer-app.owner.workers.dev"
  )
  assert.throws(() => normalizeOrigin("https://example.com/path"))
  assert.match(
    updateSiteOrigin(
      'export const siteConfig = { origin: "https://old.example.com", }',
      "https://new.example.com"
    ),
    /origin: "https:\/\/new\.example\.com"/
  )
  assert.equal(
    updateLlmsOrigin(
      "# Product\n- Production origin: https://old.example.com/\n",
      "https://new.example.com"
    ),
    "# Product\n- Production origin: https://new.example.com/\n"
  )
})

test("secret detection checks names without exposing values", () => {
  assert.equal(
    hasSecret(
      [{ name: "BETTER_AUTH_SECRET", type: "secret_text" }],
      "BETTER_AUTH_SECRET"
    ),
    true
  )
  assert.equal(hasSecret([], "BETTER_AUTH_SECRET"), false)
})

test("state merging is versioned and preserves checkpoints", () => {
  assert.deepEqual(
    mergeSetupState(
      { accountId: "one", completedSteps: ["account"] },
      { databaseId: "database-1" }
    ),
    {
      schemaVersion: 1,
      accountId: "one",
      completedSteps: ["account"],
      databaseId: "database-1",
    }
  )
})

test("captured commands keep stdout JSON separate from stderr warnings", async () => {
  const result = await run(
    process.execPath,
    [
      "-e",
      'process.stdout.write("{\\\"ok\\\":true}"); process.stderr.write("warning")',
    ],
    { capture: true, echo: false }
  )

  assert.equal(result.output, '{"ok":true}')
  assert.equal(result.errorOutput, "warning")
})
