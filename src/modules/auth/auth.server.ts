import { env, waitUntil } from "cloudflare:workers"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import { captcha, jwt } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { sendEmail } from "@/modules/email/send-email.server"
import type { SendEmailInput } from "@/modules/email/types"
import { ensureDefaultProject } from "@/modules/tasks/repository.server"
import { log } from "@/platform/log"

import { getAuthDatabase } from "./repository.server"

interface AuthEnvironment {
  APP_ENV: "local" | "production"
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL: string
  DB: D1Database
  TURNSTILE_SECRET_KEY?: string
  TURNSTILE_SITE_KEY?: string
}

// Endpoints that create accounts, check credentials, or send email. Each
// request needs a fresh Turnstile token in the x-captcha-response header.
export const captchaProtectedEndpoints = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
  "/send-verification-email",
]

interface AuthDependencies {
  database?: D1Database
  defer?: (promise: Promise<unknown>) => void
  environment?: AuthEnvironment
  send?: (input: SendEmailInput) => Promise<unknown>
}

/** The protected MCP resource; access tokens carry it as their audience. */
export function mcpResource(baseURL: string) {
  return new URL("/mcp", baseURL).href
}

/** Where the OAuth provider sends users to sign in and to approve a client. */
export const oauthLoginPage = "/login"
export const oauthConsentPage = "/oauth/consent"

// Better Auth as the OAuth 2.1 authorization server for MCP clients such as
// Claude (ADR-0014). The JWT plugin signs the audience-bound access tokens and
// serves the JWKS that /mcp verifies them with. Clients register through
// Dynamic Client Registration, rate-limited in the auth route.
function mcpPlugins(environment: AuthEnvironment) {
  return [
    jwt(),
    mcp({
      loginPage: oauthLoginPage,
      consentPage: oauthConsentPage,
      resource: mcpResource(environment.BETTER_AUTH_URL),
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
    }),
  ]
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

  // A configured site key means the challenge is required, so a missing
  // secret fails closed instead of silently disabling bot protection.
  if (environment.TURNSTILE_SITE_KEY && !environment.TURNSTILE_SECRET_KEY) {
    throw new Error("Authentication is not configured")
  }
}

function captchaPlugins(environment: AuthEnvironment) {
  if (!environment.TURNSTILE_SITE_KEY || !environment.TURNSTILE_SECRET_KEY) {
    return []
  }

  return [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: environment.TURNSTILE_SECRET_KEY,
      endpoints: captchaProtectedEndpoints,
      // Test keys report a placeholder hostname, so only production pins it.
      allowedHostnames:
        environment.APP_ENV === "production"
          ? [new URL(environment.BETTER_AUTH_URL).hostname]
          : undefined,
    }),
  ]
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
      // Cloudflare sets cf-connecting-ip at the edge; x-forwarded-for can be
      // supplied by the client.
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
    // The built-in limiter keeps counters in isolate memory, which Workers do
    // not share. AUTH_LIMITER enforces limits in the auth route instead.
    rateLimit: {
      enabled: false,
    },
    // Forward only the level, message, and error messages; extra arguments
    // can carry request URLs or account details.
    logger: {
      level: "warn",
      log: (level, message, ...args) => {
        const errors = args
          .filter((value): value is Error => value instanceof Error)
          .map((error) => error.message)
        const fields = { event: "auth.log", level, errors }
        if (level === "error") log.error(message, fields)
        else if (level === "warn") log.warn(message, fields)
        else log.info(message, fields)
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
    // tanstackStartCookies() must remain the last plugin.
    plugins: [
      ...captchaPlugins(environment),
      ...mcpPlugins(environment),
      tanstackStartCookies(),
    ],
  })
}

export function getAuth() {
  return createAuth()
}
