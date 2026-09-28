import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  attachmentsNoAccessMessage,
  attachmentsOffMessage,
  bucketStatus,
  deployResources,
  filesBucketName,
  isTopLevelBuild,
  listsDatabase,
  prepareDatabase,
  prepareFiles,
  resolveWorkerName,
  secretStatus,
  shouldCreateSecret,
  withFilesBinding,
} from "./deploy-resources.mjs"

// Wrangler's own wording for a failed API request, as a build log shows it.
function apiError(message, code, path = "r2/buckets/tanbase-core-files") {
  return `✘ [ERROR] A request to the Cloudflare API (/accounts/0123/${path}) failed.\n\n  ${message} [code: ${code}]`
}

function failed(output) {
  return { status: 1, stdout: "", output }
}

const missingBucket = failed(
  apiError("The specified bucket does not exist.", 10006)
)
const notEntitled = failed(
  apiError("Account not entitled to this feature.", 10042)
)
const refused = failed(apiError("Authentication error", 10000))
const unreachable = failed("fetch failed")
const ok = { status: 0, stdout: "", output: "" }

/** A stand-in for Wrangler that answers by command and records each call. */
function fakeWrangler(answers) {
  const calls = []
  const wrangler = (args) => {
    const command = args.join(" ")
    calls.push(command)
    const key = Object.keys(answers).find((prefix) =>
      command.startsWith(prefix)
    )
    const answer = key ? answers[key] : ok
    return Array.isArray(answer) ? (answer.shift() ?? ok) : answer
  }
  return { calls, wrangler }
}

function collect() {
  const lines = []
  return { lines, log: (line) => lines.push(line) }
}

test("reads the database, the Worker name, and no bucket from the top level", () => {
  assert.deepEqual(deployResources(readFileSync("wrangler.jsonc", "utf8")), {
    database: { name: "tanbase-core", id: null },
    bucket: null,
    name: "tanbase-core",
  })
})

test("keeps the bucket a copy made before ADR-0021 declares", () => {
  assert.deepEqual(
    deployResources(`{
      "name": "shop",
      "d1_databases": [{ "binding": "DB", "database_name": "shop", "database_id": "abc" }],
      "r2_buckets": [{ "binding": "FILES", "bucket_name": "legacy-files" }],
    }`),
    {
      database: { name: "shop", id: "abc" },
      bucket: { name: "legacy-files" },
      name: "shop",
    }
  )
  assert.throws(() => deployResources("{ not json"), /could not be parsed/)
})

test("names the Worker from the CI override, then the build, then the config", () => {
  assert.equal(
    resolveWorkerName({ override: "moondo", built: "a", config: "b" }),
    "moondo"
  )
  assert.equal(
    resolveWorkerName({ override: "  ", built: "a", config: "b" }),
    "a"
  )
  assert.equal(resolveWorkerName({ config: "b" }), "b")
  assert.throws(() => resolveWorkerName({}), /no name/)
})

test("derives a valid R2 bucket name from the Worker", () => {
  assert.equal(filesBucketName("moondo"), "moondo-files")
  assert.equal(filesBucketName("My App_2"), "my-app-2-files")
  assert.equal(filesBucketName("---"), "tanbase-core-files")
  const long = filesBucketName("a".repeat(70))
  assert.equal(long.length, 63)
  assert.match(long, /^a+-files$/)
  assert.equal(
    filesBucketName(`${"a".repeat(56)}-b`),
    `${"a".repeat(56)}-files`
  )
})

test("tells a top-level build from an environment's", () => {
  assert.equal(isTopLevelBuild({ name: "x" }), true)
  assert.equal(isTopLevelBuild({ targetEnvironment: "production" }), false)
})

test("sets or removes the FILES binding without touching the rest", () => {
  const config = {
    name: "x",
    r2_buckets: [
      { binding: "FILES", bucket_name: "old" },
      { binding: "OTHER", bucket_name: "other" },
    ],
  }
  assert.deepEqual(withFilesBinding(config, "new").r2_buckets, [
    { binding: "OTHER", bucket_name: "other" },
    { binding: "FILES", bucket_name: "new" },
  ])
  assert.deepEqual(withFilesBinding(config, null).r2_buckets, [
    { binding: "OTHER", bucket_name: "other" },
  ])
  assert.deepEqual(withFilesBinding({ name: "x" }, "a").r2_buckets, [
    { binding: "FILES", bucket_name: "a" },
  ])
  assert.equal(config.r2_buckets.length, 2)
  assert.equal(withFilesBinding(config, "new").name, "x")
})

test("reads wrangler d1 list --json", () => {
  const list = JSON.stringify([{ uuid: "1", name: "tanbase-core" }])
  assert.equal(listsDatabase(list, "tanbase-core"), true)
  assert.equal(listsDatabase(list, "other"), false)
  assert.equal(listsDatabase(`▲ [WARNING] note\n${list}`, "tanbase-core"), true)
  assert.equal(listsDatabase("[]", "tanbase-core"), false)
  assert.equal(listsDatabase("not json", "tanbase-core"), null)
})

test("classifies what wrangler r2 bucket info found", () => {
  assert.equal(bucketStatus(ok), "exists")
  assert.equal(bucketStatus(missingBucket), "missing")
  assert.equal(bucketStatus(notEntitled), "not-enabled")
  assert.equal(bucketStatus(refused), "no-access")
  assert.equal(bucketStatus(unreachable), "unknown")
})

test("creates a missing database before migrations", () => {
  const { calls, wrangler } = fakeWrangler({
    "d1 list": { status: 0, stdout: "[]", output: "[]" },
  })
  prepareDatabase({ name: "tanbase-core", id: null }, wrangler, () => {})
  assert.deepEqual(calls, [
    "d1 list --json",
    "d1 create tanbase-core --update-config=false",
  ])
})

test("leaves an existing or configured database alone", () => {
  const existing = fakeWrangler({
    "d1 list": {
      status: 0,
      stdout: JSON.stringify([{ name: "tanbase-core" }]),
      output: "",
    },
  })
  prepareDatabase(
    { name: "tanbase-core", id: null },
    existing.wrangler,
    () => {}
  )
  assert.deepEqual(existing.calls, ["d1 list --json"])

  const configured = fakeWrangler({})
  prepareDatabase(
    { name: "tanbase-core", id: "abc" },
    configured.wrangler,
    () => {}
  )
  prepareDatabase(null, configured.wrangler, () => {})
  assert.deepEqual(configured.calls, [])
})

test("stops when the database cannot be created, and goes on when it cannot be listed", () => {
  const broken = fakeWrangler({
    "d1 list": { status: 0, stdout: "[]", output: "[]" },
    "d1 create": failed("quota exceeded"),
  })
  assert.throws(
    () => prepareDatabase({ name: "db", id: null }, broken.wrangler, () => {}),
    /could not be created:\nquota exceeded/
  )

  const { lines, log } = collect()
  const unlisted = fakeWrangler({ "d1 list": unreachable })
  prepareDatabase({ name: "db", id: null }, unlisted.wrangler, log)
  assert.deepEqual(unlisted.calls, ["d1 list --json"])
  assert.equal(lines.length, 1)
})

test("binds an existing bucket", () => {
  const { calls, wrangler } = fakeWrangler({})
  assert.equal(
    prepareFiles("app-files", wrangler, () => {}),
    "app-files"
  )
  assert.deepEqual(calls, ["r2 bucket info app-files --json"])
})

test("creates a missing bucket, then binds it", () => {
  const { calls, wrangler } = fakeWrangler({ "r2 bucket info": missingBucket })
  assert.equal(
    prepareFiles("app-files", wrangler, () => {}),
    "app-files"
  )
  assert.deepEqual(calls, [
    "r2 bucket info app-files --json",
    "r2 bucket create app-files --update-config=false",
  ])
})

test("turns attachments off, and says how to turn them on, when R2 is not enabled", () => {
  const { lines, log } = collect()
  const { calls, wrangler } = fakeWrangler({ "r2 bucket info": notEntitled })
  assert.equal(prepareFiles("app-files", wrangler, log), null)
  assert.deepEqual(lines, [attachmentsOffMessage])
  assert.ok(!calls.some((call) => call.startsWith("r2 bucket create")))

  const created = collect()
  const denied = fakeWrangler({
    "r2 bucket info": missingBucket,
    "r2 bucket create": notEntitled,
  })
  assert.equal(prepareFiles("app-files", denied.wrangler, created.log), null)
  assert.equal(created.lines.at(-1), attachmentsOffMessage)
})

test("turns attachments off when Cloudflare refuses the check", () => {
  const { lines, log } = collect()
  const { wrangler } = fakeWrangler({ "r2 bucket info": refused })
  assert.equal(prepareFiles("app-files", wrangler, log), null)
  assert.deepEqual(lines, [attachmentsNoAccessMessage])
})

test("retries an unreadable check once before turning attachments off", () => {
  const recovered = fakeWrangler({ "r2 bucket info": [unreachable, ok] })
  assert.equal(
    prepareFiles("app-files", recovered.wrangler, () => {}),
    "app-files"
  )
  assert.equal(recovered.calls.length, 2)

  const { lines, log } = collect()
  const lost = fakeWrangler({ "r2 bucket info": [unreachable, unreachable] })
  assert.equal(prepareFiles("app-files", lost.wrangler, log), null)
  assert.match(lines[0], /could not be checked/)
})

test("reads whether the Worker has BETTER_AUTH_SECRET", () => {
  const list = (secrets) => ({
    status: 0,
    stdout: JSON.stringify(secrets),
    output: "",
  })
  assert.equal(
    secretStatus(list([{ name: "BETTER_AUTH_SECRET", type: "secret_text" }])),
    "present"
  )
  assert.equal(secretStatus(list([{ name: "POSTHOG_KEY" }])), "absent")
  assert.equal(secretStatus(list([])), "absent")
  assert.equal(
    secretStatus(
      failed(
        `✘ [ERROR] Worker "moondo" not found.\n\nIf this is a new Worker, run \`wrangler deploy\` first to create it.`
      )
    ),
    "no-worker"
  )
  assert.equal(
    secretStatus(
      failed(apiError("This Worker does not exist.", 10007, "workers/scripts"))
    ),
    "no-worker"
  )
  assert.equal(secretStatus(refused), "unknown")
  assert.equal(secretStatus(unreachable), "unknown")
  assert.equal(
    secretStatus({ status: 0, stdout: "not json", output: "" }),
    "unknown"
  )
})

test("creates the secret only when it is known to be missing", () => {
  assert.equal(shouldCreateSecret("absent"), true)
  assert.equal(shouldCreateSecret("no-worker"), true)
  assert.equal(shouldCreateSecret("present"), false)
  assert.equal(shouldCreateSecret("unknown"), false)
})
