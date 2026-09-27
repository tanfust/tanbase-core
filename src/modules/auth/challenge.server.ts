import { env } from "cloudflare:workers"

import { isEmailDeliveryConfigured } from "@/modules/email/send-email.server"

export interface AuthChallengeConfig {
  turnstileSiteKey: string | null
  /**
   * Whether this deployment sends email. Without it, sign-up needs no
   * verification and password reset links cannot be delivered.
   */
  emailDelivery: boolean
}

// The site key is public. The paired secret never leaves the Worker.
export function readAuthChallengeConfig(): AuthChallengeConfig {
  // Generated types narrow the key to this repository's values; an
  // installation without a widget sets it to "".
  const siteKey: string = env.TURNSTILE_SITE_KEY
  return {
    turnstileSiteKey: siteKey || null,
    emailDelivery: isEmailDeliveryConfigured(env),
  }
}
