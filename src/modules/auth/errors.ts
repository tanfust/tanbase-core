interface AuthClientError {
  code?: string
  message?: string
  status?: number
}

const captchaErrorCodes = new Set(["MISSING_RESPONSE", "VERIFICATION_FAILED"])

/** The code the auth client gives a Worker that ran out of CPU time. */
export const workerResourceLimitCode = "WORKER_RESOURCE_LIMIT"

const workerResourceLimitMessage =
  "Cloudflare stopped this request because the site ran out of CPU time (error 1102). The Cloudflare account running it likely needs Workers Paid, since signing in takes more CPU than Workers Free allows."

/**
 * A readable auth error for the page Cloudflare serves, in place of the
 * Worker's answer, when the Worker exceeds its CPU limit: error 1102, which
 * sign-in hits on Workers Free. Cloudflare marks its error pages with
 * `cf-error-type`; an HTML page that names the error also counts. Any other
 * response is left alone.
 */
export async function edgeErrorResponse(
  response: Response
): Promise<Response | undefined> {
  if (response.ok) return undefined
  const html = (response.headers.get("content-type") ?? "").includes(
    "text/html"
  )
  const limited =
    response.headers.get("cf-error-type") === "1102" ||
    (html && /\b1102\b/.test(await response.clone().text()))
  if (!limited) return undefined
  return new Response(
    JSON.stringify({
      code: workerResourceLimitCode,
      message: workerResourceLimitMessage,
    }),
    {
      status: response.status,
      statusText: response.statusText,
      headers: { "content-type": "application/json" },
    }
  )
}

/** Maps Better Auth client errors to messages for the auth forms. */
export function authErrorMessage(error: AuthClientError, fallback: string) {
  if (error.status === 429) {
    return "Too many attempts. Wait a minute and try again."
  }

  if (error.code && captchaErrorCodes.has(error.code)) {
    return "Complete the security check, then try again."
  }

  if (error.code === workerResourceLimitCode) {
    return workerResourceLimitMessage
  }

  return error.message ?? fallback
}
