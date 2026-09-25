import { env } from "cloudflare:workers"

export interface AuthChallengeConfig {
  turnstileSiteKey: string | null
}

// The site key is public. The paired secret never leaves the Worker.
export function readAuthChallengeConfig(): AuthChallengeConfig {
  // Generated types narrow the key to this repository's values; an
  // installation without a widget sets it to "".
  const siteKey: string = env.TURNSTILE_SITE_KEY
  return { turnstileSiteKey: siteKey || null }
}
