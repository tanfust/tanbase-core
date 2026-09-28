import { env, waitUntil } from "cloudflare:workers"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { captcha, jwt } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import {
  isEmailDeliveryConfigured,
  sendEmail,
} from "@/modules/email/send-email.server"
import { siteConfig } from "@/lib/site"
import type { SendEmailInput } from "@/modules/email/types"
import { ensureDefaultProject } from "@/modules/tasks/repository.server"
import { log } from "@/platform/log"
import { configuredOrigin } from "@/platform/origin"
import { getRequestContext } from "@/platform/request-context"

import { getAuthDatabase } from "./repository.server"
import { authSecretUsable } from "./installation.server"
import { authBodyError } from "./schemas"

interface AuthEnvironment {
  APP_ENV: "local" | "production"
  BETTER_AUTH_SECRET?: string
  /** The public origin. Unset, auth uses the origin of the current request. */
  BETTER_AUTH_URL?: string
  DB: D1Database
  EMAIL?: unknown
  EMAIL_FROM?: string
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
  /**
   * Whether email can be delivered. With it, new accounts must verify their
   * address; without it, they sign in straight away. Defaults to whether the
   * sender address and the Email Service binding are both configured.
   */
  emailDelivery?: boolean
  environment?: AuthEnvironment
  /** The public origin, when there is no request context, as in tests. */
  origin?: string
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
function mcpPlugins(origin: string) {
  return [
    jwt(),
    mcp({
      loginPage: oauthLoginPage,
      consentPage: oauthConsentPage,
      resource: mcpResource(origin),
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
    }),
  ]
}

function getAuthEnvironment(): AuthEnvironment {
  return env
}

function validateAuthEnvironment(environment: AuthEnvironment) {
  if (!authSecretUsable(environment.BETTER_AUTH_SECRET)) {
    throw new Error("Authentication is not configured")
  }

  // A configured site key means the challenge is required, so a missing
  // secret fails closed instead of silently disabling bot protection.
  if (environment.TURNSTILE_SITE_KEY && !environment.TURNSTILE_SECRET_KEY) {
    throw new Error("Authentication is not configured")
  }
}

/**
 * The origin auth issues cookies, links, and tokens for: the configured
 * public origin, or the one the request arrived on.
 */
function resolveAuthOrigin(
  environment: AuthEnvironment,
  explicit?: string
): string {
  let origin: string | null | undefined = explicit
  try {
    origin ??= configuredOrigin(environment.BETTER_AUTH_URL)
  } catch {
    throw new Error("Authentication is not configured")
  }
  origin ??= getRequestContext()?.origin
  if (!origin) throw new Error("Authentication is not configured")
  return origin
}

function captchaPlugins(environment: AuthEnvironment, origin: string) {
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
          ? [new URL(origin).hostname]
          : undefined,
    }),
  ]
}

export function createAuth(dependencies: AuthDependencies = {}) {
  const environment = dependencies.environment ?? getAuthEnvironment()
  validateAuthEnvironment(environment)
  const origin = resolveAuthOrigin(environment, dependencies.origin)
  const emailDelivery =
    dependencies.emailDelivery ?? isEmailDeliveryConfigured(environment)

  const database = dependencies.database ?? environment.DB
  const defer = dependencies.defer ?? waitUntil
  const send = dependencies.send ?? sendEmail

  function deliver(input: SendEmailInput) {
    defer(send(input))
    return Promise.resolve()
  }

  return betterAuth({
    appName: siteConfig.name,
    baseURL: origin,
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
      // Verification needs email. A deployment without delivery lets new
      // accounts in straight away; set up Email Service to require it.
      requireEmailVerification: emailDelivery,
      sendResetPassword: ({ user: authUser, url }) =>
        deliver({
          to: authUser.email,
          subject: `Reset your ${siteConfig.name} password`,
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
      sendOnSignUp: emailDelivery,
      sendVerificationEmail: ({ user: authUser, url }) =>
        deliver({
          to: authUser.email,
          subject: `Verify your ${siteConfig.name} email`,
          template: "verifyEmail",
          props: {
            name: authUser.name,
            verificationUrl: url,
            expiresInMinutes: 60,
          },
        }),
    },
    // The forms validate with the same schemas; this holds for every client.
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const message = authBodyError(ctx.path, ctx.body)
        if (message) throw new APIError("BAD_REQUEST", { message })
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
      ...captchaPlugins(environment, origin),
      ...mcpPlugins(origin),
      tanstackStartCookies(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

interface CachedAuth {
  database: D1Database
  key: string
  auth: Auth
}

const cachedAuth = new Map<string, CachedAuth>()
// A Worker answers on a handful of origins; the bound only guards memory.
const maxCachedOrigins = 8

/**
 * The Better Auth instance for this configuration and origin. Building one
 * sets up every plugin, and each new instance makes a D1 read to seed the
 * MCP resource, so an isolate builds one per origin and reuses it.
 */
export function authFor(environment: AuthEnvironment, origin: string): Auth {
  const key = JSON.stringify([
    origin,
    environment.APP_ENV,
    environment.BETTER_AUTH_SECRET,
    environment.BETTER_AUTH_URL,
    environment.EMAIL_FROM,
    Boolean(environment.EMAIL),
    environment.TURNSTILE_SITE_KEY,
    environment.TURNSTILE_SECRET_KEY,
  ])
  const cached = cachedAuth.get(origin)
  if (cached?.key === key && cached.database === environment.DB) {
    return cached.auth
  }

  const auth = createAuth({ environment, origin })
  if (!cachedAuth.has(origin) && cachedAuth.size >= maxCachedOrigins) {
    cachedAuth.clear()
  }
  cachedAuth.set(origin, { database: environment.DB, key, auth })
  return auth
}

export function getAuth(): Auth {
  const environment = getAuthEnvironment()
  validateAuthEnvironment(environment)
  return authFor(environment, resolveAuthOrigin(environment))
}
