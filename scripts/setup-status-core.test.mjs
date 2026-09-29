import assert from "node:assert/strict"
import test from "node:test"

import {
  formatReport,
  optionalItems,
  requiredItems,
  servingVersion,
  settingOrigin,
  wranglerFailure,
} from "./setup-status-core.mjs"

// `wrangler versions view --json` as a first deploy of the top level returns
// it: the three AI variables, the database, the queue, and the new secret.
function firstDeploy(extra = [], script = {}) {
  return {
    id: "0123",
    resources: {
      script,
      bindings: [
        { type: "ai", name: "AI" },
        { type: "plain_text", name: "AI_MODEL", text: "@cf/model" },
        { type: "plain_text", name: "AI_GATEWAY_ID", text: "default" },
        { type: "plain_text", name: "AI_DAILY_LIMIT", text: "20" },
        { type: "d1", name: "DB", id: "db-id" },
        { type: "queue", name: "EMAIL_QUEUE", queue_name: "klapt-email" },
        { type: "secret_text", name: "BETTER_AUTH_SECRET" },
        ...extra,
      ],
    },
  }
}

const text = (name, value) => ({ type: "plain_text", name, text: value })
const secret = (name) => ({ type: "secret_text", name })
const byLabel = (items, label) => items.find((entry) => entry.label === label)

test("servingVersion picks the version serving the most traffic", () => {
  const stdout = JSON.stringify({
    versions: [
      { version_id: "old", percentage: 10 },
      { version_id: "new", percentage: 90 },
    ],
  })
  assert.equal(servingVersion(stdout), "new")
  assert.equal(servingVersion("not json"), null)
  assert.equal(servingVersion(JSON.stringify({ versions: [] })), null)
})

test("wranglerFailure names a missing Worker and a missing login", () => {
  assert.match(
    wranglerFailure(
      "This Worker does not exist on your account. [code: 10007]",
      "klapt"
    ),
    /No Worker named "klapt".*--name <worker>/
  )
  assert.match(
    wranglerFailure("You are not authenticated. [code: 10000]", "klapt"),
    /wrangler login/
  )
  assert.equal(wranglerFailure("Something else broke.", "klapt"), null)
})

test("settingOrigin reads BETTER_AUTH_URL as the Worker does", () => {
  assert.deepEqual(settingOrigin("klapt.ai"), {
    origin: "https://klapt.ai",
    invalid: false,
  })
  assert.deepEqual(settingOrigin(" https://app.example.com/ "), {
    origin: "https://app.example.com",
    invalid: false,
  })
  assert.deepEqual(settingOrigin(""), { origin: null, invalid: false })
  assert.deepEqual(settingOrigin(undefined), { origin: null, invalid: false })
  assert.deepEqual(settingOrigin("ftp://example.com"), {
    origin: null,
    invalid: true,
  })
})

test("a first deploy needs nothing and has every optional setting off but AI", () => {
  const version = firstDeploy()
  assert.deepEqual(
    requiredItems(version).map((entry) => entry.state),
    ["ok", "ok", "ok"]
  )
  const optional = optionalItems(version)
  assert.deepEqual(
    optional.map((entry) => [entry.label, entry.state]),
    [
      ["Custom domain", "off"],
      ["Email", "off"],
      ["Due-date reminders", "off"],
      ["Bot checks", "off"],
      ["Analytics", "off"],
      ["Attachments", "off"],
      ["Placement", "off"],
      ["AI task breakdown", "on"],
    ]
  )
  assert.match(
    byLabel(optional, "Due-date reminders").detail,
    /klapt-email is bound; reminders wait on email and BETTER_AUTH_URL/
  )
  for (const entry of optional.filter((each) => each.state === "off")) {
    assert.ok(entry.next, `${entry.label} says how to turn it on`)
    assert.match(entry.section, /^docs\/DEPLOYMENT\.md#/)
  }
})

test("a deploy without pnpm run deploy lacks the secret and the queue", () => {
  const version = firstDeploy()
  version.resources.bindings = version.resources.bindings.filter(
    (binding) => !["BETTER_AUTH_SECRET", "EMAIL_QUEUE"].includes(binding.name)
  )
  const secretItem = byLabel(requiredItems(version), "Sign-in secret")
  assert.equal(secretItem.state, "attention")
  assert.match(secretItem.next, /pnpm run deploy/)
  assert.match(
    byLabel(optionalItems(version), "Due-date reminders").next,
    /pnpm run deploy/
  )
})

test("APP_ENV other than production needs attention", () => {
  const items = requiredItems(firstDeploy([text("APP_ENV", "local")]))
  assert.equal(byLabel(items, "Environment").state, "attention")
  assert.equal(
    byLabel(
      requiredItems(firstDeploy([text("APP_ENV", "production")])),
      "Environment"
    ).state,
    "ok"
  )
})

test("BETTER_AUTH_URL is on, ignored, or not serving yet", () => {
  const pinned = firstDeploy([text("BETTER_AUTH_URL", "klapt.ai")])
  assert.equal(byLabel(optionalItems(pinned), "Custom domain").state, "on")
  assert.equal(
    byLabel(optionalItems(pinned, { originServes: true }), "Custom domain")
      .state,
    "on"
  )
  const waiting = byLabel(
    optionalItems(pinned, { originServes: false }),
    "Custom domain"
  )
  assert.equal(waiting.state, "attention")
  assert.match(waiting.detail, /https:\/\/klapt\.ai.*sign-in works only there/)

  const ignored = byLabel(
    optionalItems(firstDeploy([text("BETTER_AUTH_URL", "ftp://klapt.ai")])),
    "Custom domain"
  )
  assert.equal(ignored.state, "attention")
  assert.match(ignored.detail, /not a web address/)
})

test("email is on only with a sender and its binding", () => {
  const sender = text("EMAIL_FROM", "noreply@send.example.com")
  const binding = { type: "send_email", name: "EMAIL" }
  assert.equal(
    byLabel(optionalItems(firstDeploy([sender, binding])), "Email").state,
    "on"
  )
  const halfway = byLabel(optionalItems(firstDeploy([sender])), "Email")
  assert.equal(halfway.state, "attention")
  assert.match(halfway.detail, /logged, not sent/)
})

test("reminders are on with the queue, email, and a pinned origin", () => {
  const version = firstDeploy([
    text("EMAIL_FROM", "noreply@send.example.com"),
    { type: "send_email", name: "EMAIL" },
    text("BETTER_AUTH_URL", "https://app.example.com"),
  ])
  assert.equal(
    byLabel(optionalItems(version), "Due-date reminders").state,
    "on"
  )
})

test("a Turnstile site key without its secret needs attention", () => {
  const siteKey = text("TURNSTILE_SITE_KEY", "0x4AAA")
  const secretKey = secret("TURNSTILE_SECRET_KEY")
  const alone = byLabel(optionalItems(firstDeploy([siteKey])), "Bot checks")
  assert.equal(alone.state, "attention")
  assert.match(alone.detail, /stops sign-in/)
  assert.equal(
    byLabel(optionalItems(firstDeploy([siteKey, secretKey])), "Bot checks")
      .state,
    "on"
  )
  const secretOnly = byLabel(
    optionalItems(firstDeploy([secretKey])),
    "Bot checks"
  )
  assert.equal(secretOnly.state, "off")
  assert.match(secretOnly.next, /TURNSTILE_SITE_KEY/)
})

test("analytics, attachments, placement, and AI read their bindings", () => {
  const version = firstDeploy(
    [
      secret("POSTHOG_KEY"),
      { type: "r2_bucket", name: "FILES", bucket_name: "klapt-files" },
      text("AI_DAILY_LIMIT", "0"),
    ],
    { placement: { mode: "targeted" } }
  )
  // A later binding with the same name wins, as the last one listed.
  const items = optionalItems(version)
  assert.match(byLabel(items, "Analytics").detail, /us\.i\.posthog\.com/)
  assert.match(byLabel(items, "Attachments").detail, /klapt-files/)
  assert.equal(byLabel(items, "Placement").state, "on")
  assert.equal(byLabel(items, "AI task breakdown").state, "off")
})

test("formatReport lists each setting and what to do next", () => {
  const version = firstDeploy([text("TURNSTILE_SITE_KEY", "0x4AAA")])
  const report = formatReport({
    worker: "klapt",
    versionId: "0123",
    required: requiredItems(version),
    optional: optionalItems(version),
  })
  assert.match(report, /^Worker "klapt", version 0123/)
  assert.match(report, /attention\s+Bot checks: .*stops sign-in/)
  assert.match(report, /Next: Add the TURNSTILE_SECRET_KEY secret/)
  assert.match(
    report,
    /See docs\/DEPLOYMENT\.md#turnstile-and-auth-rate-limits/
  )
  assert.match(report, /on\s+AI task breakdown/)
  assert.match(report, /1 setting needs attention\.$/)
  assert.doesNotMatch(report, /ok\s+Database.*\n\s+Next:/)
})
