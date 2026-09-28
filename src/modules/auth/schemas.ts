import { z } from "zod/mini"

import "@/lib/zod-config"

// Better Auth's own limits: 8 to 128 characters.
const minPasswordLength = 8
const maxPasswordLength = 128

// The forms load these schemas, so they use `zod/mini`: the browser then
// carries only the checks below, not all of Zod.

const email = z.pipe(
  z.string().check(z.trim(), z.minLength(1, "Enter your email.")),
  z.email("Enter a valid email address.")
)

const name = z
  .string()
  .check(
    z.trim(),
    z.minLength(1, "Enter your name."),
    z.maxLength(80, "Use at most 80 characters for your name.")
  )

function newPassword(tooShort: string) {
  return z
    .string()
    .check(
      z.minLength(minPasswordLength, tooShort),
      z.maxLength(
        maxPasswordLength,
        `Use at most ${maxPasswordLength} characters for your password.`
      )
    )
}

// Each schema below validates the form in the browser and the same fields in
// Better Auth's endpoint, through the `before` hook in auth.server.ts. Form
// schemas add only what never leaves the browser, such as a confirmation.

export const signInSchema = z.object({
  email,
  password: z.string().check(z.minLength(1, "Enter your password.")),
})

export const signUpSchema = z.object({
  name,
  email,
  password: newPassword(
    `Use at least ${minPasswordLength} characters for your password.`
  ),
})

export const signUpFormSchema = z
  .extend(signUpSchema, { confirmation: z.string() })
  .check(
    z.refine((value) => value.password === value.confirmation, {
      message: "Passwords do not match.",
      path: ["confirmation"],
    })
  )

export const emailRequestSchema = z.object({ email })

export const resetPasswordSchema = z.object({
  newPassword: newPassword(
    `Use at least ${minPasswordLength} characters for your password.`
  ),
})

export const resetPasswordFormSchema = z
  .extend(resetPasswordSchema, { confirmation: z.string() })
  .check(
    z.refine((value) => value.newPassword === value.confirmation, {
      message: "Passwords do not match.",
      path: ["confirmation"],
    })
  )

export const updateProfileSchema = z.object({ name })

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .check(z.minLength(1, "Enter your current password.")),
  newPassword: newPassword(
    `Use at least ${minPasswordLength} characters for the new password.`
  ),
})

export const changePasswordFormSchema = z
  .extend(changePasswordSchema, { confirmation: z.string() })
  .check(
    z.refine((value) => value.newPassword === value.confirmation, {
      message: "New passwords do not match.",
      path: ["confirmation"],
    })
  )

/**
 * The request body each Better Auth endpoint must satisfy, by path. Extra
 * fields, such as `callbackURL`, pass through untouched.
 */
export const authBodySchemas: Readonly<Record<string, z.ZodMiniType>> = {
  "/sign-in/email": signInSchema,
  "/sign-up/email": signUpSchema,
  "/request-password-reset": emailRequestSchema,
  "/send-verification-email": emailRequestSchema,
  "/reset-password": resetPasswordSchema,
  // A profile update may change other fields; a name it sends must be valid.
  "/update-user": z.partial(updateProfileSchema),
  "/change-password": changePasswordSchema,
}

/** The first message a body fails with, or null when it is valid. */
export function authBodyError(path: string, body: unknown): string | null {
  const schema = Object.hasOwn(authBodySchemas, path)
    ? authBodySchemas[path]
    : undefined
  if (!schema) return null
  const result = schema.safeParse(body)
  return result.success ? null : (result.error.issues[0]?.message ?? null)
}
