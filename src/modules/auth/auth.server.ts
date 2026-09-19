import { env, waitUntil } from "cloudflare:workers"
import { betterAuth } from "better-auth"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { sendEmail } from "@/modules/email/send-email.server"
import type { SendEmailInput } from "@/modules/email/types"
import { ensureDefaultProject } from "@/modules/tasks/repository.server"

import { getAuthDatabase } from "./repository.server"

interface AuthEnvironment {
  APP_ENV: "local" | "production"
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL: string
  DB: D1Database
}

interface AuthDependencies {
  database?: D1Database
  defer?: (promise: Promise<unknown>) => void
  environment?: AuthEnvironment
  send?: (input: SendEmailInput) => Promise<unknown>
}

function getAuthEnvironment(): AuthEnvironment {
  return env
}

function validateAuthEnvironment(environment: AuthEnvironment) {
  if (!environment.BETTER_AUTH_SECRET) {
    throw new Error("Authentication is not configured")
  }

  if (environment.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("Authentication is not configured")
  }

  try {
    new URL(environment.BETTER_AUTH_URL)
  } catch {
    throw new Error("Authentication is not configured")
  }
}

export function createAuth(dependencies: AuthDependencies = {}) {
  const environment = dependencies.environment ?? getAuthEnvironment()
  validateAuthEnvironment(environment)

  const database = dependencies.database ?? environment.DB
  const defer = dependencies.defer ?? waitUntil
  const send = dependencies.send ?? sendEmail

  function deliver(input: SendEmailInput) {
    defer(send(input))
    return Promise.resolve()
  }

  return betterAuth({
    appName: "TanBase Core",
    baseURL: environment.BETTER_AUTH_URL,
    secret: environment.BETTER_AUTH_SECRET,
    database: getAuthDatabase(database),
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: ({ user: authUser, url }) =>
        deliver({
          to: authUser.email,
          subject: "Reset your TanBase Core password",
          template: "resetPassword",
          props: {
            name: authUser.name,
            resetUrl: url,
            expiresInMinutes: 60,
          },
        }),
    },
    emailVerification: {
      expiresIn: 60 * 60,
      sendOnSignUp: true,
      sendVerificationEmail: ({ user: authUser, url }) =>
        deliver({
          to: authUser.email,
          subject: "Verify your TanBase Core email",
          template: "verifyEmail",
          props: {
            name: authUser.name,
            verificationUrl: url,
            expiresInMinutes: 60,
          },
        }),
    },
    databaseHooks: {
      session: {
        create: {
          after: async (authSession) => {
            await ensureDefaultProject(authSession.userId, database)
          },
        },
      },
    },
    plugins: [tanstackStartCookies()],
  })
}

export function getAuth() {
  return createAuth()
}
