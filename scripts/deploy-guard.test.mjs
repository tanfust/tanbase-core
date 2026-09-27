import assert from "node:assert/strict"
import test from "node:test"

import {
  isUpstreamRemote,
  originUrl,
  remoteTip,
  supersedingCommit,
} from "./deploy-guard.mjs"

const older = "d169717e0000000000000000000000000000000a"
const newer = "023fb25a0000000000000000000000000000000b"

test("skips a Workers Build of main once main has moved on", () => {
  assert.equal(
    supersedingCommit({ ci: "1", branch: "main", commit: older, tip: newer }),
    newer
  )
})

test("deploys the build for the tip of main", () => {
  assert.equal(
    supersedingCommit({ ci: "1", branch: "main", commit: newer, tip: newer }),
    null
  )
})

test("always deploys outside Workers Builds or off main", () => {
  assert.equal(
    supersedingCommit({
      ci: undefined,
      branch: "main",
      commit: older,
      tip: newer,
    }),
    null
  )
  assert.equal(
    supersedingCommit({
      ci: "1",
      branch: "feature",
      commit: older,
      tip: newer,
    }),
    null
  )
})

test("deploys when the commit or tip is unknown", () => {
  assert.equal(
    supersedingCommit({
      ci: "1",
      branch: "main",
      commit: undefined,
      tip: newer,
    }),
    null
  )
  assert.equal(
    supersedingCommit({ ci: "1", branch: "main", commit: older, tip: null }),
    null
  )
})

test("reads the tip of main from git ls-remote", () => {
  const calls = []
  const tip = remoteTip((command, args) => {
    calls.push([command, ...args])
    return { status: 0, stdout: `${newer}\trefs/heads/main\n` }
  })
  assert.equal(tip, newer)
  assert.deepEqual(calls, [["git", "ls-remote", "origin", "refs/heads/main"]])
})

test("returns null when git fails or prints nothing usable", () => {
  assert.equal(
    remoteTip(() => ({ status: 128, stdout: "" })),
    null
  )
  assert.equal(
    remoteTip(() => ({ status: 0, stdout: "" })),
    null
  )
  assert.equal(
    remoteTip(() => ({ status: 0, stdout: "not-a-sha" })),
    null
  )
})

test("recognizes the upstream TanBase remote in every URL form", () => {
  for (const url of [
    "https://github.com/tanfust/tanbase-core",
    "https://github.com/tanfust/tanbase-core.git",
    "git@github.com:tanfust/tanbase-core.git",
    "https://github.com/tanfust/tanbase-core/\n",
  ]) {
    assert.equal(isUpstreamRemote(url), true, url)
  }
})

test("lets forks deploy, including look-alike names", () => {
  for (const url of [
    "https://github.com/someone/tanbase-core",
    "git@github.com:someone/my-app.git",
    "https://github.com/tanfust/tanbase-core-fork",
    "https://gitlab.com/tanfust/tanbase-core",
    "",
  ]) {
    assert.equal(isUpstreamRemote(url), false, url)
  }
})

test("reads the origin remote, or nothing without one", () => {
  assert.equal(
    originUrl(() => ({ status: 0, stdout: "git@github.com:a/b.git\n" })),
    "git@github.com:a/b.git"
  )
  assert.equal(
    originUrl(() => ({ status: 2, stdout: "" })),
    ""
  )
})
