import { execFileSync } from "node:child_process"

import { hashPassword } from "better-auth/crypto"

// Each spec signs in with its own account, so one spec changing a password
// never breaks another.
const accounts = [
  {
    userId: "e2e-verified-user",
    accountId: "e2e-verified-account",
    email: "browser-verified@example.com",
    password: "correct-horse-1",
  },
  {
    userId: "e2e-webmcp-user",
    accountId: "e2e-webmcp-account",
    email: "webmcp-verified@example.com",
    password: "correct-horse-1",
  },
]

function sqlValue(value) {
  return `'${value.replaceAll("'", "''")}'`
}

const now = Date.now()
const statements = []
for (const { userId, accountId, email, password } of accounts) {
  const passwordHash = await hashPassword(password)
  statements.push(
    `DELETE FROM task WHERE user_id = ${sqlValue(userId)}`,
    `DELETE FROM project WHERE user_id = ${sqlValue(userId)}`,
    `DELETE FROM session WHERE user_id = ${sqlValue(userId)}`,
    `DELETE FROM account WHERE user_id = ${sqlValue(userId)}`,
    `DELETE FROM user WHERE id = ${sqlValue(userId)} OR email = ${sqlValue(email)}`,
    `INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (${sqlValue(userId)}, 'Browser Test', ${sqlValue(email)}, 1, ${now}, ${now})`,
    `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (${sqlValue(accountId)}, ${sqlValue(userId)}, 'credential', ${sqlValue(userId)}, ${sqlValue(passwordHash)}, ${now}, ${now})`
  )
}

execFileSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.e2e.jsonc",
    "--persist-to",
    ".wrangler/e2e-state",
    "--command",
    statements.join(";"),
  ],
  { stdio: "ignore" }
)

console.log("Prepared the isolated verified browser-test accounts.")
