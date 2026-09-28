import assert from "node:assert/strict"
import test from "node:test"

import {
  d1LocationArgs,
  deriveWorkerName,
  emailDomain,
  findDeploymentUrl,
  hasSecret,
  isPlacementRegion,
  mergeSetupState,
  normalizeOrigin,
  parseD1Location,
  parsePlacementArguments,
  placementMessage,
  placementRegionByColo,
  placementRegionByLocationHint,
  placementRegionFor,
  r2Unavailable,
  parseArguments,
  readPlacementTarget,
  updatePlacement,
  updateSiteIdentity,
  readWranglerInstallation,
  resolveTurnstileSiteKey,
  selectAccount,
  selectDatabase,
  sendingDomainEnabled,
  setupPlan,
  updateSiteOrigin,
  updateWranglerInstallation,
} from "./core.mjs"
import { readD1Location, run } from "./runner.mjs"

const config = `{
  // The generic top level, which the Deploy to Cloudflare button deploys.
  "name": "tanbase-core",
  "vars": { "APP_ENV": "production", "BETTER_AUTH_URL": "" },
  "d1_databases": [{ "binding": "DB", "database_name": "tanbase-core" }],
  "env": {
    // Local development stays isolated.
    "local": {
      "vars": { "APP_ENV": "local" },
      "d1_databases": [
        { "binding": "DB", "database_name": "tanbase-core-local" },
      ],
      "send_email": [{ "name": "EMAIL" }],
      "r2_buckets": [
        { "binding": "FILES", "bucket_name": "tanbase-core-files-local" },
      ],
    },
    "production": {
      "name": "tanbase-core",
      "vars": {
        "APP_ENV": "production",
        "BETTER_AUTH_URL": "https://old.example.com",
        "EMAIL_FROM": "sender@example.com",
        "TURNSTILE_SITE_KEY": "0x-template-site-key",
      },
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "tanbase-core-production",
          "database_id": "old-database",
        },
      ],
      "send_email": [{ "name": "EMAIL" }],
      "r2_buckets": [
        { "binding": "FILES", "bucket_name": "tanbase-core-files" },
      ],
      "queues": {
        "producers": [{ "binding": "EMAIL_QUEUE", "queue": "tanbase-core-email" }],
        "consumers": [
          {
            "queue": "tanbase-core-email",
            "max_retries": 3,
            "dead_letter_queue": "tanbase-core-email-dlq",
          },
        ],
      },
      "triggers": { "crons": ["0 * * * *"] },
      "workflows": [
        {
          "name": "tanbase-core-task-breakdown",
          "binding": "BREAKDOWN",
          "class_name": "TaskBreakdownWorkflow",
        },
      ],
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
    appDescription: null,
    appName: null,
    dryRun: false,
    help: false,
    localOnly: false,
    placement: null,
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
      "--app-name",
      " Acme Tasks ",
      "--description",
      "Tasks for Acme.",
    ]),
    {
      accountId: "account-1",
      appDescription: "Tasks for Acme.",
      appName: "Acme Tasks",
      dryRun: false,
      help: false,
      localOnly: false,
      placement: null,
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
    emailFrom: "sender@example.com",
    filesBucketName: "tanbase-core-files",
    placementRegion: null,
    productionUrl: "https://customer-app.owner.workers.dev",
    reminderQueueName: "tanbase-core-email",
    turnstileSiteKey: "0x-template-site-key",
    workerName: "customer-app",
  })
  assert.match(updated, /"database_name": "customer-app-local"/)
  assert.match(updated, /"name": "customer-app-task-breakdown"/)
  assert.doesNotMatch(updated, /tanbase-core-task-breakdown/)
  assert.equal(updated.match(/send_email/g)?.length, 2)
  assert.match(updated, /sender@example\.com/)
  assert.match(updated, /Local development stays isolated/)
})

test("Turnstile site key updates only when explicitly requested", () => {
  const disabled = updateWranglerInstallation(config, {
    accountId: "account-1",
    databaseId: "database-1",
    databaseName: "customer-app-production",
    localDatabaseName: "customer-app-local",
    productionUrl: "https://customer-app.owner.workers.dev",
    turnstileSiteKey: "",
    workerName: "customer-app",
  })

  assert.equal(readWranglerInstallation(disabled).turnstileSiteKey, "")
})

test("disabling email removes the production binding and sender only", () => {
  const disabled = updateWranglerInstallation(config, {
    accountId: "account-1",
    databaseId: "database-1",
    databaseName: "customer-app-production",
    disableEmail: true,
    localDatabaseName: "customer-app-local",
    productionUrl: "https://customer-app.owner.workers.dev",
    workerName: "customer-app",
  })

  assert.equal(readWranglerInstallation(disabled).emailFrom, "")
  assert.equal(disabled.match(/send_email/g)?.length, 1)
  // The local binding stays; only the production one is removed.
  // The local environment's binding is untouched.
  assert.match(disabled, /^      "send_email": \[\{ "name": "EMAIL" \}\],$/m)
})

test("files bucket is personalized or removed only in production", () => {
  const personalized = updateWranglerInstallation(config, {
    accountId: "account-1",
    databaseId: "database-1",
    databaseName: "customer-app-production",
    filesBucketName: "customer-app-files",
    localDatabaseName: "customer-app-local",
    localFilesBucketName: "customer-app-files-local",
    productionUrl: "https://customer-app.owner.workers.dev",
    workerName: "customer-app",
  })
  assert.equal(
    readWranglerInstallation(personalized).filesBucketName,
    "customer-app-files"
  )
  assert.match(personalized, /"bucket_name": "customer-app-files-local"/)

  const disabled = updateWranglerInstallation(config, {
    accountId: "account-1",
    databaseId: "database-1",
    databaseName: "customer-app-production",
    disableFiles: true,
    localDatabaseName: "customer-app-local",
    productionUrl: "https://customer-app.owner.workers.dev",
    workerName: "customer-app",
  })
  assert.equal(readWranglerInstallation(disabled).filesBucketName, null)
  assert.equal(disabled.match(/r2_buckets/g)?.length, 1)
})

const placed = config.replace(
  '"production": {\n      "name": "tanbase-core",',
  '"production": {\n      "name": "tanbase-core",\n      "placement": { "region": "azure:francesouth" },'
)
const placementOptions = {
  accountId: "account-1",
  databaseName: "customer-app-production",
  localDatabaseName: "customer-app-local",
  productionUrl: "https://customer-app.owner.workers.dev",
  workerName: "customer-app",
}

test("placement stays with its database and is dropped for another", () => {
  assert.match(placed, /azure:francesouth/)

  const sameDatabase = updateWranglerInstallation(placed, {
    ...placementOptions,
    databaseId: "old-database",
  })
  assert.match(sameDatabase, /"placement": \{ "region": "azure:francesouth" \}/)

  const otherDatabase = updateWranglerInstallation(placed, {
    ...placementOptions,
    databaseId: "database-1",
  })
  assert.doesNotMatch(otherDatabase, /placement/)
  assert.equal(readWranglerInstallation(otherDatabase).databaseId, "database-1")
})

test("a known location sets the production hint for a new database", () => {
  const replaced = updateWranglerInstallation(placed, {
    ...placementOptions,
    databaseId: "database-1",
    placementRegion: "aws:eu-west-3",
  })
  // One line, as Prettier leaves it, in the same place.
  assert.match(
    replaced,
    /"name": "customer-app",\n {6}"placement": \{ "region": "aws:eu-west-3" \},\n/
  )
  assert.doesNotMatch(replaced, /francesouth/)
  assert.equal(
    readWranglerInstallation(replaced).placementRegion,
    "aws:eu-west-3"
  )

  // Without a hint, the new one goes right after production's name, and the
  // top level stays generic.
  const inserted = updateWranglerInstallation(config, {
    ...placementOptions,
    databaseId: "database-1",
    placementRegion: "azure:francesouth",
  })
  assert.match(
    inserted,
    /"production": \{\n {6}"name": "customer-app",\n {6}"placement": \{ "region": "azure:francesouth" \},\n {6}"vars"/
  )
  assert.equal(inserted.match(/placement/g)?.length, 1)
  assert.equal(
    readWranglerInstallation(inserted).placementRegion,
    "azure:francesouth"
  )

  // The same database's hint is replaced too when the location says so.
  const sameDatabase = updateWranglerInstallation(placed, {
    ...placementOptions,
    databaseId: "old-database",
    placementRegion: "aws:eu-central-1",
  })
  assert.equal(
    readWranglerInstallation(sameDatabase).placementRegion,
    "aws:eu-central-1"
  )
})

test("an explicit null removes the hint even for the same database", () => {
  const removed = updateWranglerInstallation(placed, {
    ...placementOptions,
    databaseId: "old-database",
    placementRegion: null,
  })
  assert.doesNotMatch(removed, /placement/)
  assert.equal(readWranglerInstallation(removed).placementRegion, null)

  const unchanged = updateWranglerInstallation(config, {
    ...placementOptions,
    databaseId: "database-1",
    placementRegion: null,
  })
  assert.doesNotMatch(unchanged, /placement/)
})

test("a hint is written only in the provider:region shape", () => {
  assert.throws(() =>
    updateWranglerInstallation(config, {
      ...placementOptions,
      databaseId: "database-1",
      placementRegion: "francesouth",
    })
  )
  assert.equal(isPlacementRegion("azure:francesouth"), true)
  assert.equal(isPlacementRegion("gcp:europe-west10"), true)
  assert.equal(isPlacementRegion("aws:us-east-1"), true)
  assert.equal(isPlacementRegion("francesouth"), false)
  assert.equal(isPlacementRegion("AWS:US-EAST-1"), false)
  assert.equal(isPlacementRegion("aws:"), false)
  assert.equal(isPlacementRegion("aws:us-east-1 "), false)
  assert.equal(isPlacementRegion(undefined), false)
})

// Region identifiers from GET /accounts/{account_id}/workers/placement/regions,
// read on 2026-09-28.
const acceptedPlacementRegions = new Set(
  [
    [
      "aws",
      "af-south-1 ap-east-1 ap-east-2 ap-northeast-1 ap-northeast-2 ap-northeast-3 ap-south-1 ap-south-2 ap-southeast-1 ap-southeast-2 ap-southeast-3 ap-southeast-4 ap-southeast-5 ap-southeast-6 ap-southeast-7 ca-central-1 ca-west-1 eu-central-1 eu-central-2 eu-north-1 eu-south-1 eu-south-2 eu-west-1 eu-west-2 eu-west-3 il-central-1 me-central-1 me-south-1 mx-central-1 sa-east-1 us-east-1 us-east-2 us-west-1 us-west-2",
    ],
    [
      "azure",
      "australiacentral australiacentral2 australiaeast australiasoutheast austriaeast belgiumcentral brazilsouth brazilsoutheast canadacentral canadaeast centralindia centralus chilecentral eastasia eastus eastus2 francecentral francesouth germanynorth germanywestcentral indonesiacentral israelcentral italynorth japaneast japanwest koreacentral koreasouth malaysiawest mexicocentral newzealandnorth northcentralus northeurope norwayeast norwaywest polandcentral qatarcentral southafricanorth southafricawest southcentralus southeastasia southindia spaincentral swedencentral switzerlandnorth switzerlandwest uaecentral uaenorth uksouth ukwest westcentralus westeurope westindia westus westus2 westus3",
    ],
    [
      "gcp",
      "africa-south1 asia-east1 asia-east2 asia-northeast1 asia-northeast2 asia-northeast3 asia-south1 asia-south2 asia-southeast1 asia-southeast2 australia-southeast1 australia-southeast2 europe-central2 europe-north1 europe-north2 europe-southwest1 europe-west1 europe-west10 europe-west12 europe-west2 europe-west3 europe-west4 europe-west6 europe-west8 europe-west9 me-central1 me-central2 me-west1 northamerica-northeast1 northamerica-northeast2 northamerica-south1 southamerica-east1 southamerica-west1 us-central1 us-east1 us-east4 us-east5 us-south1 us-west1 us-west2 us-west3 us-west4",
    ],
  ].flatMap(([provider, regions]) =>
    regions.split(" ").map((region) => `${provider}:${region}`)
  )
)

test("every placement region in the tables is one Cloudflare accepts", () => {
  const values = [
    ...Object.values(placementRegionByColo),
    ...Object.values(placementRegionByLocationHint),
  ]
  assert.ok(values.length > 30)
  for (const region of values) {
    assert.ok(acceptedPlacementRegions.has(region), `${region} is not accepted`)
    assert.equal(isPlacementRegion(region), true)
  }
  assert.deepEqual(Object.keys(placementRegionByLocationHint).sort(), [
    "APAC",
    "EEUR",
    "ENAM",
    "OC",
    "WEUR",
    "WNAM",
  ])
  for (const colo of Object.keys(placementRegionByColo)) {
    assert.match(colo, /^[A-Z]{3}$/)
  }
})

test("placement follows the colo, then the location hint", () => {
  // The production install: primary in Marseille, WEUR.
  assert.equal(
    placementRegionFor({ colo: "MRS", region: "WEUR" }),
    "azure:francesouth"
  )
  assert.equal(
    placementRegionFor({ colo: "mrs", region: "weur" }),
    "azure:francesouth"
  )
  assert.equal(
    placementRegionFor({ colo: "HND", region: "APAC" }),
    "aws:ap-northeast-1"
  )
  // A colo missing from the table falls back to its location hint.
  assert.equal(
    placementRegionFor({ colo: "XYZ", region: "WEUR" }),
    "aws:eu-central-1"
  )
  assert.equal(
    placementRegionFor({ colo: "XYZ", region: "OC" }),
    "aws:ap-southeast-2"
  )
  assert.equal(
    placementRegionFor({ colo: "LHR", region: "NEW" }),
    "aws:eu-west-2"
  )
  assert.equal(placementRegionFor({ colo: "XYZ", region: "NEW" }), null)
  assert.equal(
    placementRegionFor({ colo: "CONSTRUCTOR", region: "TOSTRING" }),
    null
  )
  assert.equal(placementRegionFor(null), null)
  assert.equal(placementRegionFor(undefined), null)
})

function d1Result(meta, extra = {}) {
  return JSON.stringify(
    [{ results: [{ 1: 1 }], success: true, meta, ...extra }],
    null,
    2
  )
}

const primaryMeta = {
  served_by_colo: "MRS",
  served_by_region: "WEUR",
  served_by_primary: true,
  duration: 0.2,
}

test("the D1 location comes from the primary that served the query", () => {
  assert.deepEqual(parseD1Location(d1Result(primaryMeta)), {
    colo: "MRS",
    region: "WEUR",
  })
  assert.deepEqual(
    parseD1Location(
      d1Result({
        ...primaryMeta,
        served_by_colo: "sjc",
        served_by_region: "wnam",
      })
    ),
    { colo: "SJC", region: "WNAM" }
  )
  // Anything Wrangler prints before the JSON is skipped.
  assert.deepEqual(
    parseD1Location(`Update available\n${d1Result(primaryMeta)}\n`),
    { colo: "MRS", region: "WEUR" }
  )
})

test("a D1 location that the output does not state is unknown", () => {
  assert.equal(
    parseD1Location(d1Result({ ...primaryMeta, served_by_primary: false })),
    null
  )
  for (const field of [
    "served_by_primary",
    "served_by_colo",
    "served_by_region",
  ]) {
    const meta = { ...primaryMeta }
    delete meta[field]
    assert.equal(parseD1Location(d1Result(meta)), null, field)
  }
  assert.equal(
    parseD1Location(d1Result({ ...primaryMeta, served_by_colo: "" })),
    null
  )
  assert.equal(parseD1Location(d1Result(primaryMeta, { success: false })), null)
  assert.equal(
    parseD1Location(JSON.stringify([{ results: [], success: true }])),
    null
  )
  assert.equal(parseD1Location("[]"), null)
  assert.equal(parseD1Location("null"), null)
  assert.equal(parseD1Location("not json"), null)
  assert.equal(parseD1Location(""), null)
  assert.equal(parseD1Location(undefined), null)
})

test("the location query is read-only and remote", () => {
  assert.deepEqual(d1LocationArgs("database-1"), [
    "d1",
    "execute",
    "database-1",
    "--remote",
    "--command",
    "select 1",
    "--json",
  ])
  assert.deepEqual(d1LocationArgs("DB", "production").slice(0, 5), [
    "d1",
    "execute",
    "DB",
    "--env",
    "production",
  ])
})

// A stand-in for pnpm: `node -e <script> exec wrangler ...` runs the script,
// which sees Wrangler's arguments after `wrangler`.
function fakeWrangler(script) {
  return {
    command: process.execPath,
    prefix: [
      "-e",
      `const args = process.argv.slice(process.argv.indexOf("wrangler") + 1); ${script}`,
    ],
  }
}

test("the location reader runs one query and parses its result", async () => {
  const output = d1Result(primaryMeta)
  const manager = fakeWrangler(
    `if (args.join(" ") !== "d1 execute database-1 --remote --command select 1 --json") process.exit(2); process.stdout.write(${JSON.stringify(output)})`
  )
  assert.deepEqual((await readD1Location(manager, "database-1")).location, {
    colo: "MRS",
    region: "WEUR",
  })
})

test("the location reader never throws", async () => {
  const failed = await readD1Location(
    fakeWrangler(`process.stderr.write("Not logged in."); process.exit(1)`),
    "database-1"
  )
  assert.equal(failed.location, null)
  assert.match(failed.output, /Not logged in/)

  const garbled = await readD1Location(
    fakeWrangler(`process.stdout.write("{")`),
    "database-1"
  )
  assert.equal(garbled.location, null)

  const missing = await readD1Location(
    { command: "tanbase-command-that-does-not-exist", prefix: [] },
    "database-1"
  )
  assert.equal(missing.location, null)
  assert.ok(missing.output)
})

test("the installer says where the primary is and what it chose", () => {
  const location = { colo: "MRS", region: "WEUR" }
  assert.equal(
    placementMessage({ location, placementRegion: "azure:francesouth" }),
    "The D1 primary is in MRS (WEUR), so production is placed in azure:francesouth."
  )
  assert.match(
    placementMessage({ location: null, placementRegion: null }),
    /could not be read, so production stays on default placement\. Run pnpm run placement --env production/
  )
  assert.match(
    placementMessage({ location: null, placementRegion: "azure:francesouth" }),
    /could not be read; production keeps azure:francesouth/
  )
  assert.match(
    placementMessage({
      location: { colo: "XYZ", region: "NEW" },
      placementRegion: null,
    }),
    /XYZ \(NEW\), which has no known placement region, so production stays on default placement/
  )
  assert.match(
    placementMessage({
      placementRegion: "aws:eu-west-3",
      requested: "aws:eu-west-3",
    }),
    /^Placement: aws:eu-west-3, as --placement asked\.$/
  )
  assert.match(
    placementMessage({ placementRegion: null, requested: "default" }),
    /^Placement: default, as --placement asked/
  )
  for (const message of [
    placementMessage({ location, placementRegion: "azure:francesouth" }),
    placementMessage({ location: null, placementRegion: null }),
  ]) {
    assert.doesNotMatch(message, /\n/)
  }
})

test("--placement takes a region or default", () => {
  assert.equal(
    parseArguments(["--placement", "aws:eu-west-3"]).placement,
    "aws:eu-west-3"
  )
  assert.equal(parseArguments(["--placement", "default"]).placement, "default")
  assert.throws(() => parseArguments(["--placement"]), /--placement takes/)
  assert.throws(
    () => parseArguments(["--placement", "francesouth"]),
    /--placement takes/
  )
  assert.throws(
    () => parseArguments(["--placement", "--yes"]),
    /--placement takes/
  )
  assert.throws(() =>
    parseArguments(["--local-only", "--placement", "aws:eu-west-3"])
  )
})

test("the remote plan places production after choosing its database", () => {
  const plan = setupPlan({ localOnly: false })
  const database = plan.findIndex((step) => step.includes("D1 database"))
  const placement = plan.findIndex((step) => step.includes("D1 primary"))
  assert.equal(placement, database + 1)
  assert.match(
    setupPlan({ localOnly: false, placement: "aws:eu-west-3" }).join("\n"),
    /Place the production Worker in aws:eu-west-3 \(--placement\)/
  )
  assert.match(
    setupPlan({ localOnly: false, placement: "default" }).join("\n"),
    /default placement \(--placement default\)/
  )
  assert.doesNotMatch(setupPlan({ localOnly: true }).join("\n"), /placement/i)
})

test("pnpm run placement reads its options", () => {
  assert.deepEqual(parsePlacementArguments([]), {
    accountId: null,
    environment: null,
    help: false,
    write: false,
  })
  assert.deepEqual(
    parsePlacementArguments([
      "--",
      "--env",
      "production",
      "--write",
      "--account-id",
      "account-1",
    ]),
    {
      accountId: "account-1",
      environment: "production",
      help: false,
      write: true,
    }
  )
  assert.equal(parsePlacementArguments(["-h"]).help, true)
  assert.throws(() => parsePlacementArguments(["--env"]))
  assert.throws(() => parsePlacementArguments(["--env", "--write"]))
  assert.throws(() => parsePlacementArguments(["--account-id"]))
  assert.throws(() => parsePlacementArguments(["--placement"]))
})

test("pnpm run placement reads the DB binding of one section", () => {
  assert.deepEqual(readPlacementTarget(placed), {
    databaseId: null,
    databaseName: "tanbase-core",
    placement: null,
  })
  assert.deepEqual(readPlacementTarget(placed, "production"), {
    databaseId: "old-database",
    databaseName: "tanbase-core-production",
    placement: { region: "azure:francesouth" },
  })
  assert.throws(() => readPlacementTarget(config, "staging"), /env\.staging/)
  assert.throws(
    () => readPlacementTarget('{ "d1_databases": [{ "binding": "OTHER" }] }'),
    /no DB binding/
  )
})

test("pnpm run placement writes one section's hint and keeps the rest", () => {
  const top = updatePlacement(config, { region: "aws:eu-west-3" })
  assert.match(
    top,
    /^ {2}"name": "tanbase-core",\n {2}"placement": \{ "region": "aws:eu-west-3" \},\n/m
  )
  assert.equal(top.match(/placement/g)?.length, 1)
  assert.match(top, /Local development stays isolated/)
  assert.equal(readPlacementTarget(top).placement?.region, "aws:eu-west-3")
  assert.equal(readPlacementTarget(top, "production").placement, null)

  const production = updatePlacement(placed, {
    environment: "production",
    region: "aws:eu-west-3",
  })
  assert.match(production, /"placement": \{ "region": "aws:eu-west-3" \}/)
  assert.doesNotMatch(production, /francesouth/)
  assert.equal(readPlacementTarget(production).placement, null)

  assert.throws(() =>
    updatePlacement(config, { environment: "staging", region: "aws:eu-west-3" })
  )
  assert.throws(() => updatePlacement(config, { region: "eu-west-3" }))
})

test("reminder queues are personalized or removed with the cron", () => {
  const options = {
    accountId: "account-1",
    databaseId: "database-1",
    databaseName: "customer-app-production",
    localDatabaseName: "customer-app-local",
    productionUrl: "https://customer-app.owner.workers.dev",
    workerName: "customer-app",
  }

  const personalized = updateWranglerInstallation(config, {
    ...options,
    reminderQueueName: "customer-app-email",
  })
  assert.equal(
    readWranglerInstallation(personalized).reminderQueueName,
    "customer-app-email"
  )
  assert.equal(personalized.match(/"customer-app-email"/g)?.length, 2)
  assert.match(personalized, /"dead_letter_queue": "customer-app-email-dlq"/)
  assert.match(personalized, /"crons": \["0 \* \* \* \*"\]/)

  const disabled = updateWranglerInstallation(config, {
    ...options,
    disableReminders: true,
  })
  assert.equal(readWranglerInstallation(disabled).reminderQueueName, null)
  assert.doesNotMatch(disabled, /EMAIL_QUEUE/)
  assert.match(disabled, /"crons": \[\]/)
})

test("R2 availability errors are recognized", () => {
  assert.equal(
    r2Unavailable(
      "Please enable R2 through the Cloudflare Dashboard. [code: 10042]"
    ),
    true
  )
  assert.equal(
    r2Unavailable("The specified bucket does not exist. [code: 10006]"),
    false
  )
})

test("email sending detection reads the Wrangler table by domain", () => {
  const output = [
    "┌─────────────┬──────────────────┬─────────┬─────┐",
    "│ zone        │ name             │ enabled │ tag │",
    "├─────────────┼──────────────────┼─────────┼─────┤",
    "│ tanbase.dev │ send.tanbase.dev │ yes     │ e9b │",
    "│ example.com │ mail.example.com │ no      │ a1c │",
    "└─────────────┴──────────────────┴─────────┴─────┘",
  ].join("\n")

  assert.equal(emailDomain("noreply@Send.Tanbase.dev"), "send.tanbase.dev")
  assert.equal(emailDomain("TanBase <noreply@send.tanbase.dev>"), null)
  assert.equal(emailDomain(""), null)
  assert.equal(sendingDomainEnabled(output, "send.tanbase.dev"), true)
  assert.equal(sendingDomainEnabled(output, "mail.example.com"), false)
  assert.equal(sendingDomainEnabled(output, "other.dev"), false)
  assert.equal(
    sendingDomainEnabled("No sending subdomains found.", "send.tanbase.dev"),
    false
  )
})

test("production Turnstile stays enabled only with its Worker secret", () => {
  const secret = [{ name: "TURNSTILE_SECRET_KEY", type: "secret_text" }]
  const other = [{ name: "BETTER_AUTH_SECRET", type: "secret_text" }]

  assert.equal(resolveTurnstileSiteKey("0x-site", secret), "0x-site")
  assert.equal(resolveTurnstileSiteKey("0x-site", other), "")
  assert.equal(resolveTurnstileSiteKey("0x-site", []), "")
  assert.equal(resolveTurnstileSiteKey("", secret), "")
  assert.equal(resolveTurnstileSiteKey(null, secret), "")
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

test("renames the app in the site config, leaving the author alone", () => {
  const source = `export const siteConfig: SiteConfig = {
  name: "TanBase Core",
  shortName: "TanBase",
  tagline: "TanStack Start on Cloudflare Workers",
  description:
    "An open-source foundation.",
  id: "tanbase-core",
  author: { name: "Tanfust", url: "https://github.com/tanfust" },
}`

  const renamed = updateSiteIdentity(source, {
    name: 'Acme "Tasks"',
    description: "Tasks for Acme.",
    id: "acme-tasks",
  })

  assert.match(renamed, /^  name: "Acme \\"Tasks\\"",$/m)
  assert.match(renamed, /^  shortName: "Acme \\"Tasks\\"",$/m)
  assert.match(renamed, /^  id: "acme-tasks",$/m)
  assert.match(renamed, /description:\n    "Tasks for Acme\.",/)
  assert.match(renamed, /author: \{ name: "Tanfust"/)
  assert.equal(updateSiteIdentity(source, {}), source)
  assert.throws(() => updateSiteIdentity("const x = {}", { name: "Acme" }))
})
