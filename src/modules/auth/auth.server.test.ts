import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import type { SendEmailInput } from "@/modules/email/types"
import { listProjects } from "@/modules/tasks/repository.server"

import { createAuth } from "./auth.server"

const baseURL = "http://localhost:3000"
const testSecret = "test-only-secret-that-is-at-least-32-characters"

function createTestAuth() {
  const deliveries: SendEmailInput[] = []
  const pending: Promise<unknown>[] = []
  const auth = createAuth({
    database: env.DB,
    environment: {
      APP_ENV: "local",
      BETTER_AUTH_SECRET: testSecret,
      BETTER_AUTH_URL: baseURL,
      DB: env.DB,
    },
    defer: (promise) => pending.push(promise),
    send: async (input) => {
      deliveries.push(input)
    },
  })

  return {
    auth,
    deliveries,
    async flushDeliveries() {
      await Promise.all(pending.splice(0))
    },
  }
}

function authRequest(
  path: string,
  body?: Record<string, unknown>,
  cookie?: string
) {
  return new Request(new URL(`/api/auth${path}`, baseURL), {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      origin: baseURL,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  })
}

function sessionCookie(response: Response) {
  const setCookie = response.headers.get("set-cookie")
  expect(setCookie).toBeTruthy()
  return setCookie!.split(";", 1)[0]
}

function isSignUpBody(
  value: unknown
): value is { user: { id: string; emailVerified: boolean } } {
  if (!value || typeof value !== "object" || !("user" in value)) return false

  const { user } = value
  return (
    !!user &&
    typeof user === "object" &&
    "id" in user &&
    typeof user.id === "string" &&
    "emailVerified" in user &&
    typeof user.emailVerified === "boolean"
  )
}

describe("Better Auth D1 core", () => {
  it("rejects missing runtime secrets without exposing configuration", () => {
    expect(() =>
      createAuth({
        database: env.DB,
        environment: {
          APP_ENV: "local",
          BETTER_AUTH_URL: baseURL,
          DB: env.DB,
        },
      })
    ).toThrow("Authentication is not configured")
  })

  it("supports the verified email, session, sign-out, and reset journey", async () => {
    const { auth, deliveries, flushDeliveries } = createTestAuth()
    const email = `owner-${crypto.randomUUID()}@example.com`
    const initialPassword = "initial-password-123"
    const newPassword = "replacement-password-456"

    const signUpResponse = await auth.handler(
      authRequest("/sign-up/email", {
        callbackURL: "/app",
        email,
        name: "Template Owner",
        password: initialPassword,
      })
    )
    expect(signUpResponse.status).toBe(200)
    const signUpBody = await signUpResponse.json()
    expect(isSignUpBody(signUpBody)).toBe(true)
    if (!isSignUpBody(signUpBody)) {
      throw new Error("Sign-up response was invalid")
    }
    expect(signUpBody.user.emailVerified).toBe(false)

    await flushDeliveries()
    expect(deliveries).toHaveLength(1)
    const verificationEmail = deliveries[0]
    expect(verificationEmail.template).toBe("verifyEmail")
    if (verificationEmail.template !== "verifyEmail") {
      throw new Error("Verification email was not queued")
    }

    const resendResponse = await auth.handler(
      authRequest("/send-verification-email", {
        email,
        callbackURL: "/login?verified=true",
      })
    )
    expect(resendResponse.status).toBe(200)
    await flushDeliveries()
    expect(deliveries).toHaveLength(2)

    expect(await listProjects(signUpBody.user.id, env.DB)).toEqual([])

    const verifyResponse = await auth.handler(
      new Request(verificationEmail.props.verificationUrl, {
        redirect: "manual",
      })
    )
    expect(verifyResponse.status).toBe(302)

    const signInResponse = await auth.handler(
      authRequest("/sign-in/email", {
        email,
        password: initialPassword,
      })
    )
    expect(signInResponse.status).toBe(200)
    const cookie = sessionCookie(signInResponse)

    const projects = await listProjects(signUpBody.user.id, env.DB)
    expect(projects).toHaveLength(1)
    expect(projects[0]?.name).toBe("My Project")

    const sessionResponse = await auth.handler(
      authRequest("/get-session", undefined, cookie)
    )
    expect(sessionResponse.status).toBe(200)
    await expect(sessionResponse.json()).resolves.toMatchObject({
      user: { id: signUpBody.user.id, email },
    })

    const signOutResponse = await auth.handler(
      authRequest("/sign-out", {}, cookie)
    )
    expect(signOutResponse.status).toBe(200)

    const signedOutSessionResponse = await auth.handler(
      authRequest("/get-session", undefined, cookie)
    )
    await expect(signedOutSessionResponse.json()).resolves.toBeNull()

    const resetRequestResponse = await auth.handler(
      authRequest("/request-password-reset", {
        email,
        redirectTo: "/reset-password",
      })
    )
    expect(resetRequestResponse.status).toBe(200)
    await flushDeliveries()

    const resetEmail = deliveries.at(-1)
    expect(resetEmail?.template).toBe("resetPassword")
    if (!resetEmail || resetEmail.template !== "resetPassword") {
      throw new Error("Reset email was not queued")
    }

    const resetUrl = new URL(resetEmail.props.resetUrl)
    const resetToken =
      resetUrl.searchParams.get("token") ?? resetUrl.pathname.split("/").at(-1)
    expect(resetToken).toBeTruthy()

    const resetResponse = await auth.handler(
      authRequest("/reset-password", {
        newPassword,
        token: resetToken,
      })
    )
    expect(resetResponse.status).toBe(200)

    const oldPasswordResponse = await auth.handler(
      authRequest("/sign-in/email", {
        email,
        password: initialPassword,
      })
    )
    expect(oldPasswordResponse.status).toBe(401)

    const newPasswordResponse = await auth.handler(
      authRequest("/sign-in/email", {
        email,
        password: newPassword,
      })
    )
    expect(newPasswordResponse.status).toBe(200)

    const updatedCookie = sessionCookie(newPasswordResponse)
    const updateUserResponse = await auth.handler(
      authRequest("/update-user", { name: "Updated Owner" }, updatedCookie)
    )
    expect(updateUserResponse.status).toBe(200)

    const changedPassword = "final-password-789"
    const changePasswordResponse = await auth.handler(
      authRequest(
        "/change-password",
        {
          currentPassword: newPassword,
          newPassword: changedPassword,
          revokeOtherSessions: false,
        },
        updatedCookie
      )
    )
    expect(changePasswordResponse.status).toBe(200)

    const finalSignInResponse = await auth.handler(
      authRequest("/sign-in/email", { email, password: changedPassword })
    )
    expect(finalSignInResponse.status).toBe(200)

    const invalidResetResponse = await auth.handler(
      authRequest("/reset-password", {
        newPassword: "unused-password-123",
        token: "invalid-token",
      })
    )
    expect(invalidResetResponse.status).toBe(400)
  })
})
