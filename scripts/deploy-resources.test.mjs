import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  bucketStatus,
  deployResources,
  listsDatabase,
  prepareResources,
  r2NoAccessMessage,
  r2NotEnabledMessage,
} from "./deploy-resources.mjs"

// Wrangler's own wording for a failed API request, as a build log shows it.
function apiError(message, code) {
  return `✘ [ERROR] A request to the Cloudflare API (/accounts/0123/r2/buckets/tanbase-core-files) failed.\n\n  ${message} [code: ${code}]`
}

const missingBucket = {
  status: 1,
  stdout: "",
  output: apiError("The specified bucket does not exist.", 10006),
}
const notEntitled = {
  status: 1,
  stdout: "",
  output: apiError("Account not entitled to this feature.", 10042),
}
const ok = { status: 0, stdout: "", output: "" }

/** A stand-in for Wrangler that answers by command and records each call. */
function fakeWrangler(answers) {
  const calls = []
  const wrangler = (args) => {
    calls.push(args.join(" "))
    const key = Object.keys(answers).find((prefix) =>
      args.join(" ").startsWith(prefix)
    )
    return key ? answers[key] : ok
  }
  return { calls, wrangler }
}

const resources = {
  database: { name: "tanbase-core", id: null },
  bucket: { name: "tanbase-core-files" },
}

test("reads the database and bucket of wrangler.jsonc's top level", () => {
  assert.deepEqual(deployResources(readFileSync("wrangler.jsonc", "utf8")), {
    database: { name: "tanbase-core", id: null },
    bucket: { name: "tanbase-core-files" },
  })
  assert.deepEqual(
    deployResources(`{
      "d1_databases": [{ "binding": "DB", "database_name": "shop", "database_id": "abc" }],
    }`),
    { database: { name: "shop", id: "abc" }, bucket: null }
  )
})

test("reads wrangler d1 list --json", () => {
  const list = JSON.stringify([{ uuid: "1", name: "tanbase-core" }])
  assert.equal(listsDatabase(list, "tanbase-core"), true)
  assert.equal(listsDatabase(list, "other"), false)
  assert.equal(listsDatabase("[]", "tanbase-core"), false)
  assert.equal(listsDatabase("not json", "tanbase-core"), null)
})

test("classifies what wrangler r2 bucket info found", () => {
  assert.equal(bucketStatus(ok), "exists")
  assert.equal(bucketStatus(missingBucket), "missing")
  assert.equal(bucketStatus(notEntitled), "not-enabled")
  assert.equal(
    bucketStatus({
      status: 1,
      output: apiError("Authentication error", 10000),
    }),
    "no-access"
  )
  assert.equal(bucketStatus({ status: 1, output: "fetch failed" }), "unknown")
})

test("creates a missing database and bucket before deploying", () => {
  const { calls, wrangler } = fakeWrangler({
    "d1 list": { status: 0, stdout: "[]", output: "[]" },
    "r2 bucket info": missingBucket,
  })
  prepareResources(resources, wrangler, () => undefined)
  assert.deepEqual(calls, [
    "d1 list --json",
    "d1 create tanbase-core --update-config=false",
    "r2 bucket info tanbase-core-files --json",
    "r2 bucket create tanbase-core-files --update-config=false",
  ])
})

test("leaves existing resources alone", () => {
  const { calls, wrangler } = fakeWrangler({
    "d1 list": {
      status: 0,
      stdout: JSON.stringify([{ name: "tanbase-core" }]),
      output: "",
    },
  })
  prepareResources(resources, wrangler, () => undefined)
  assert.deepEqual(calls, [
    "d1 list --json",
    "r2 bucket info tanbase-core-files --json",
  ])
})

test("skips the database check when the config names its ID", () => {
  const { calls, wrangler } = fakeWrangler({})
  prepareResources(
    { database: { name: "tanbase-core", id: "abc" }, bucket: null },
    wrangler,
    () => undefined
  )
  assert.deepEqual(calls, [])
})

test("stops with what to do when R2 is not enabled", () => {
  const { calls, wrangler } = fakeWrangler({
    "d1 list": { status: 0, stdout: "[]", output: "[]" },
    "r2 bucket info": notEntitled,
  })
  assert.throws(() => prepareResources(resources, wrangler, () => undefined), {
    message: r2NotEnabledMessage,
  })
  assert.ok(!calls.some((call) => call.startsWith("r2 bucket create")))
})

test("stops when Cloudflare refuses the R2 request", () => {
  const { wrangler } = fakeWrangler({
    "r2 bucket info": {
      status: 1,
      stdout: "",
      output: apiError("Authentication error", 10000),
    },
  })
  assert.throws(
    () =>
      prepareResources(
        { database: null, bucket: resources.bucket },
        wrangler,
        () => undefined
      ),
    { message: r2NoAccessMessage }
  )
})

test("goes on when a check cannot be read", () => {
  const lines = []
  const { calls, wrangler } = fakeWrangler({
    "d1 list": { status: 1, stdout: "", output: "fetch failed" },
    "r2 bucket info": { status: 1, stdout: "", output: "fetch failed" },
  })
  prepareResources(resources, wrangler, (line) => lines.push(line))
  assert.deepEqual(calls, [
    "d1 list --json",
    "r2 bucket info tanbase-core-files --json",
  ])
  assert.equal(lines.length, 2)
})
