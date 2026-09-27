import { describe, expect, it } from "vitest"

import {
  authBodyError,
  changePasswordFormSchema,
  signUpFormSchema,
  signUpSchema,
} from "./schemas"

function messages(result: {
  success: boolean
  error?: { issues: { path: PropertyKey[]; message: string }[] }
}) {
  return (result.error?.issues ?? []).map((issue) => [
    issue.path.join("."),
    issue.message,
  ])
}

describe("auth schemas", () => {
  it("names each problem on the field that has it", () => {
    expect(
      messages(
        signUpFormSchema.safeParse({
          name: " ",
          email: "",
          password: "short",
          confirmation: "other",
        })
      )
    ).toEqual([
      ["name", "Enter your name."],
      ["email", "Enter your email."],
      ["password", "Use at least 8 characters for your password."],
      ["confirmation", "Passwords do not match."],
    ])
    expect(
      messages(
        changePasswordFormSchema.safeParse({
          currentPassword: "",
          newPassword: "long-enough-1",
          confirmation: "long-enough-2",
        })
      )
    ).toEqual([
      ["currentPassword", "Enter your current password."],
      ["confirmation", "New passwords do not match."],
    ])
  })

  it("sends Better Auth the trimmed fields, without the confirmation", () => {
    const value = signUpFormSchema.parse({
      name: "  Ada  ",
      email: " ada@example.com ",
      password: "long-enough-1",
      confirmation: "long-enough-1",
    })
    expect(signUpSchema.parse(value)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      password: "long-enough-1",
    })
  })

  it("checks endpoint bodies by path and ignores other endpoints", () => {
    expect(
      authBodyError("/sign-up/email", {
        name: "Ada",
        email: "ada@example.com",
        password: "long-enough-1",
        callbackURL: "/app",
      })
    ).toBeNull()
    expect(authBodyError("/sign-in/email", { email: "x", password: "" })).toBe(
      "Enter a valid email address."
    )
    expect(authBodyError("/update-user", { image: null })).toBeNull()
    expect(authBodyError("/sign-out", {})).toBeNull()
    expect(authBodyError("toString", {})).toBeNull()
  })
})
