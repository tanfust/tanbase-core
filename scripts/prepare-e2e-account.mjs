import { execFileSync } from "node:child_process"

import { hashPassword } from "better-auth/crypto"

const userId = "e2e-verified-user"
const accountId = "e2e-verified-account"
const email = "browser-verified@example.com"
const password = "correct-horse-1"

function sqlValue(value) {
  return `'${value.replaceAll("'", "''")}'`
}

const passwordHash = await hashPassword(password)
const now = Date.now()
const sql = [
  `DELETE FROM task WHERE user_id = ${sqlValue(userId)}`,
  `DELETE FROM project WHERE user_id = ${sqlValue(userId)}`,
  `DELETE FROM session WHERE user_id = ${sqlValue(userId)}`,
  `DELETE FROM account WHERE user_id = ${sqlValue(userId)}`,
  `DELETE FROM user WHERE id = ${sqlValue(userId)} OR email = ${sqlValue(email)}`,
  `INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (${sqlValue(userId)}, 'Browser Test', ${sqlValue(email)}, 1, ${now}, ${now})`,
  `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (${sqlValue(accountId)}, ${sqlValue(userId)}, 'credential', ${sqlValue(userId)}, ${sqlValue(passwordHash)}, ${now}, ${now})`,
].join(";")

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
    sql,
  ],
  { stdio: "ignore" }
)

console.log("Prepared the isolated verified browser-test account.")
