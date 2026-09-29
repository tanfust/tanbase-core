// `pnpm run setup:status` reads the version a Worker is serving and says what
// its first deploy left off, from DEPLOYMENT's "Finishing the setup" list, so
// its owner, or a coding agent working in their copy, knows what to set up or
// remove (ADR-0022). These helpers turn `wrangler versions view --json` into
// that list; they never see a secret's value, only its name.

const guide = "docs/DEPLOYMENT.md"

/** The current version's ID, from `wrangler deployments status --json`. */
export function servingVersion(stdout) {
  let status
  try {
    status = JSON.parse(stdout)
  } catch {
    return null
  }
  const versions = Array.isArray(status?.versions) ? status.versions : []
  const [largest] = [...versions].sort(
    (a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)
  )
  return typeof largest?.version_id === "string" ? largest.version_id : null
}

/** Why a Wrangler command failed, as the one step that fixes it. */
export function wranglerFailure(output, worker) {
  if (/\[code: 10007\]|does not exist on your account/i.test(output)) {
    return `No Worker named "${worker}" on this account. Pass the name you gave it on the setup page: pnpm run setup:status -- --name <worker>`
  }
  if (
    /not (logged|authenticated)|\[code: (10000|9106)\]|Authentication error|wrangler login/i.test(
      output
    )
  ) {
    return "Wrangler is not logged in to this Cloudflare account. Run pnpm exec wrangler login, then try again."
  }
  return null
}

/**
 * A `BETTER_AUTH_URL` value read as the Worker reads it (src/platform/origin.ts):
 * a bare host means https, and anything that is still not an http or https
 * URL is ignored.
 */
export function settingOrigin(value) {
  const trimmed = value?.trim()
  if (!trimmed) return { origin: null, invalid: false }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { origin: url.origin, invalid: false }
    }
  } catch {
    // Falls through: not a web address.
  }
  return { origin: null, invalid: true }
}

function readBindings(version) {
  const bindings = version?.resources?.bindings ?? []
  const byName = new Map(bindings.map((binding) => [binding.name, binding]))
  const text = (name) => {
    const binding = byName.get(name)
    return binding?.type === "plain_text" ? (binding.text ?? "").trim() : ""
  }
  const has = (name, type) => byName.get(name)?.type === type
  return { byName, text, has }
}

function item(state, label, detail, next, section) {
  return { state, label, detail, next: next ?? null, section: section ?? null }
}

/**
 * What the Worker needs to sign anyone in. Each entry is `ok` or
 * `attention`, with the step that fixes it.
 */
export function requiredItems(version) {
  const { byName, text, has } = readBindings(version)
  const database = byName.get("DB")
  const appEnv = text("APP_ENV")
  return [
    database?.type === "d1"
      ? item("ok", "Database", "DB is bound.")
      : item(
          "attention",
          "Database",
          "There is no DB binding.",
          "Deploy with pnpm run deploy, which creates and binds the database.",
          `${guide}#importing-the-repository-from-the-dashboard`
        ),
    has("BETTER_AUTH_SECRET", "secret_text")
      ? item("ok", "Sign-in secret", "BETTER_AUTH_SECRET is set.")
      : item(
          "attention",
          "Sign-in secret",
          "BETTER_AUTH_SECRET is missing, so no one can sign in.",
          "Deploy with pnpm run deploy, which creates it.",
          `${guide}#importing-the-repository-from-the-dashboard`
        ),
    appEnv && appEnv !== "production"
      ? item(
          "attention",
          "Environment",
          `APP_ENV is "${appEnv}", so the site runs as local development.`,
          "Remove APP_ENV, or set it to production."
        )
      : item("ok", "Environment", "The site runs as production."),
  ]
}

/**
 * Each optional setting from "Finishing the setup": `on`, `off`, or
 * `attention` when it is half set up. `originServes` says whether the
 * pinned origin answers with this version: true, false, or null when it was
 * not checked.
 */
export function optionalItems(version, { originServes = null } = {}) {
  const { byName, text, has } = readBindings(version)
  const section = (anchor) => `${guide}#${anchor}`
  const items = []

  const origin = settingOrigin(text("BETTER_AUTH_URL"))
  if (origin.invalid) {
    items.push(
      item(
        "attention",
        "Custom domain",
        `BETTER_AUTH_URL is "${text("BETTER_AUTH_URL")}", which is not a web address, so it is ignored.`,
        "Set it to the site's full origin, such as https://app.example.com, or remove it.",
        section("finishing-the-setup")
      )
    )
  } else if (origin.origin && originServes === false) {
    items.push(
      item(
        "attention",
        "Custom domain",
        `BETTER_AUTH_URL is ${origin.origin}, which does not serve this version yet, and sign-in works only there.`,
        "Add the domain under the Worker's Settings → Domains & Routes and wait for it to serve, or remove BETTER_AUTH_URL.",
        section("finishing-the-setup")
      )
    )
  } else if (origin.origin) {
    items.push(
      item("on", "Custom domain", `The site is pinned to ${origin.origin}.`)
    )
  } else {
    items.push(
      item(
        "off",
        "Custom domain",
        "The site uses the address each request arrives on.",
        "Add a domain under the Worker's Settings → Domains & Routes, then set BETTER_AUTH_URL to its origin, such as https://app.example.com.",
        section("finishing-the-setup")
      )
    )
  }

  const emailFrom = text("EMAIL_FROM")
  const emailBinding = has("EMAIL", "send_email")
  const email = Boolean(emailFrom && emailBinding)
  if (email) {
    items.push(item("on", "Email", `Mail is sent from ${emailFrom}.`))
  } else if (emailFrom) {
    items.push(
      item(
        "attention",
        "Email",
        `EMAIL_FROM is ${emailFrom}, but there is no EMAIL binding, so mail is logged, not sent.`,
        "Add the send_email binding named EMAIL for that sender, then redeploy.",
        section("transactional-email")
      )
    )
  } else {
    items.push(
      item(
        "off",
        "Email",
        "Mail is logged, not sent, and sign-up needs no verification.",
        "Onboard a sender domain in Cloudflare Email Service, add a send_email binding named EMAIL, and set EMAIL_FROM.",
        section("transactional-email")
      )
    )
  }

  const queue = byName.get("EMAIL_QUEUE")
  if (queue?.type !== "queue") {
    items.push(
      item(
        "off",
        "Due-date reminders",
        "There is no reminder queue.",
        "Deploy with pnpm run deploy, which binds <worker>-email; reminders also need email and BETTER_AUTH_URL.",
        section("finishing-the-setup")
      )
    )
  } else if (!email || !origin.origin) {
    const missing = [!email && "email", !origin.origin && "BETTER_AUTH_URL"]
      .filter(Boolean)
      .join(" and ")
    items.push(
      item(
        "off",
        "Due-date reminders",
        `The queue ${queue.queue_name} is bound; reminders wait on ${missing}.`,
        `Turn on ${missing}.`,
        section("finishing-the-setup")
      )
    )
  } else {
    items.push(
      item(
        "on",
        "Due-date reminders",
        `Reminders go through ${queue.queue_name}.`
      )
    )
  }

  const siteKey = text("TURNSTILE_SITE_KEY")
  const turnstileSecret = has("TURNSTILE_SECRET_KEY", "secret_text")
  if (siteKey && turnstileSecret) {
    items.push(
      item("on", "Bot checks", "Turnstile guards sign-up and sign-in.")
    )
  } else if (siteKey) {
    items.push(
      item(
        "attention",
        "Bot checks",
        "TURNSTILE_SITE_KEY is set without the TURNSTILE_SECRET_KEY secret, which stops sign-in.",
        "Add the TURNSTILE_SECRET_KEY secret, or remove TURNSTILE_SITE_KEY.",
        section("turnstile-and-auth-rate-limits")
      )
    )
  } else {
    items.push(
      item(
        "off",
        "Bot checks",
        turnstileSecret
          ? "The TURNSTILE_SECRET_KEY secret is set, but TURNSTILE_SITE_KEY is not."
          : "Sign-up has no Turnstile challenge.",
        turnstileSecret
          ? "Set TURNSTILE_SITE_KEY to the widget's site key."
          : "Add the Turnstile secret as the TURNSTILE_SECRET_KEY secret, then set TURNSTILE_SITE_KEY.",
        section("turnstile-and-auth-rate-limits")
      )
    )
  }

  if (has("POSTHOG_KEY", "secret_text")) {
    const host = text("POSTHOG_HOST") || "https://us.i.posthog.com"
    items.push(item("on", "Analytics", `PostHog reports to ${host}.`))
  } else {
    items.push(
      item(
        "off",
        "Analytics",
        "No analytics load.",
        "Add the POSTHOG_KEY secret, and set POSTHOG_HOST for a region other than the US.",
        section("analytics")
      )
    )
  }

  const files = byName.get("FILES")
  items.push(
    files?.type === "r2_bucket"
      ? item("on", "Attachments", `Files are stored in ${files.bucket_name}.`)
      : item(
          "off",
          "Attachments",
          "Tasks take no attachments.",
          "Enable R2 Object Storage on the account, then redeploy with pnpm run deploy.",
          section("finishing-the-setup")
        )
  )

  const placement = version?.resources?.script?.placement?.mode
  items.push(
    placement
      ? item(
          "on",
          "Placement",
          `The Worker runs by the database (${placement}).`
        )
      : item(
          "off",
          "Placement",
          "The Worker runs where each request arrives, which is slower far from the database.",
          "Run pnpm run placement --write, then commit and push.",
          section("worker-placement")
        )
  )

  const model = text("AI_MODEL")
  const limit = Number(text("AI_DAILY_LIMIT") || 0)
  items.push(
    byName.get("AI")?.type === "ai" &&
      model &&
      Number.isInteger(limit) &&
      limit > 0
      ? item(
          "on",
          "AI task breakdown",
          `${model}, up to ${limit} a day per person, billed to this account after its free daily Neurons. AI_DAILY_LIMIT set to 0 turns it off.`
        )
      : item("off", "AI task breakdown", "Task breakdown is off.")
  )

  return items
}

/** The report `pnpm run setup:status` prints. */
export function formatReport({ worker, versionId, required, optional }) {
  const width = Math.max(
    ...[...required, ...optional].map((entry) => entry.state.length)
  )
  const lines = (entries) =>
    entries.flatMap((entry) => {
      const head = `  ${entry.state.padEnd(width)}  ${entry.label}: ${entry.detail}`
      const pad = " ".repeat(width + 4)
      const rest = []
      if (entry.state === "off" || entry.state === "attention") {
        if (entry.next) rest.push(`${pad}Next: ${entry.next}`)
        if (entry.section) rest.push(`${pad}See ${entry.section}`)
      }
      return [head, ...rest]
    })
  const attention = [...required, ...optional].filter(
    (entry) => entry.state === "attention"
  ).length
  return [
    `Worker "${worker}", version ${versionId}`,
    "",
    "Required",
    ...lines(required),
    "",
    "Optional",
    ...lines(optional),
    "",
    attention > 0
      ? `${attention} ${attention === 1 ? "setting needs" : "settings need"} attention.`
      : "Nothing needs attention. Each setting that is off can stay off.",
  ].join("\n")
}
