import { env } from "cloudflare:workers"

import { isEmailDeliveryConfigured } from "@/modules/email/send-email.server"

import { findInstallationProblem } from "./installation.server"
import type { InstallationProblem } from "./installation"

export interface AuthChallengeConfig {
  turnstileSiteKey: string | null
  /**
   * Whether this deployment sends email. Without it, sign-up needs no
   * verification and password reset links cannot be delivered.
   */
  emailDelivery: boolean
  /** What an unfinished deployment is missing, for the auth pages to say. */
  installationProblem: InstallationProblem | null
}

// The site key is public. The paired secret never leaves the Worker.
export async function readAuthChallengeConfig(): Promise<AuthChallengeConfig> {
  // Generated types narrow the key to this repository's values; an
  // installation without a widget sets it to "".
  const siteKey: string = env.TURNSTILE_SITE_KEY
  return {
    turnstileSiteKey: siteKey || null,
    emailDelivery: isEmailDeliveryConfigured(env),
    installationProblem: await findInstallationProblem(env),
  }
}
