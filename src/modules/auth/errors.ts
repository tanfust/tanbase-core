interface AuthClientError {
  code?: string
  message?: string
  status?: number
}

const captchaErrorCodes = new Set(["MISSING_RESPONSE", "VERIFICATION_FAILED"])

/** Maps Better Auth client errors to messages for the auth forms. */
export function authErrorMessage(error: AuthClientError, fallback: string) {
  if (error.status === 429) {
    return "Too many attempts. Wait a minute and try again."
  }

  if (error.code && captchaErrorCodes.has(error.code)) {
    return "Complete the security check, then try again."
  }

  return error.message ?? fallback
}
