import { CircleAlertIcon } from "lucide-react"

import { siteConfig } from "@/lib/site"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type {
  InstallationProblem,
  OriginMismatch,
} from "@/modules/auth/installation"

const deploymentGuide = `${siteConfig.sourceRepository}/blob/main/docs/DEPLOYMENT.md`

function GuideLink({ section, label }: { section: string; label: string }) {
  return (
    <p>
      <a
        className="underline underline-offset-4"
        href={`${deploymentGuide}#${section}`}
        rel="noreferrer"
        target="_blank"
      >
        {label}
      </a>
    </p>
  )
}

/**
 * Says what keeps this deployment from signing anyone in, so its owner knows
 * the one step to take: a database without tables or no usable secret
 * (ADR-0021), or a `BETTER_AUTH_URL` for another address (ADR-0022).
 */
export function SetupNotice({
  problem,
  originMismatch = null,
}: {
  problem: InstallationProblem | null
  originMismatch?: OriginMismatch | null
}) {
  if (problem) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden="true" />
        <AlertTitle>This site is not set up yet</AlertTitle>
        <AlertDescription>
          {problem === "database" ? (
            <p>
              Its database has no tables. If you deployed it, open the Worker in
              the Cloudflare dashboard, set{" "}
              <strong>Settings → Build → Deploy command</strong> to{" "}
              <code>pnpm run deploy</code>, and retry the latest build. That
              command also creates the auth secret.
            </p>
          ) : (
            <p>
              It has no usable <code>BETTER_AUTH_SECRET</code>. If you deployed
              it, redeploy with <code>pnpm run deploy</code>, which creates one
              when it is missing, or replace a secret shorter than 32 characters
              under <strong>Settings → Variables and Secrets</strong>.
            </p>
          )}
          <GuideLink
            section="importing-the-repository-from-the-dashboard"
            label="How to finish the deployment"
          />
        </AlertDescription>
      </Alert>
    )
  }

  if (originMismatch) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden="true" />
        <AlertTitle>
          Sign-in works only at {originMismatch.configured}
        </AlertTitle>
        <AlertDescription>
          <p>
            This deployment&apos;s <code>BETTER_AUTH_URL</code> is{" "}
            {originMismatch.configured}, but this page is at{" "}
            {originMismatch.current}, so signing in here fails. Open{" "}
            {originMismatch.configured} once that address points at this Worker.
            To sign in here instead, remove <code>BETTER_AUTH_URL</code> from{" "}
            <code>wrangler.jsonc</code> or under{" "}
            <strong>Settings → Variables and Secrets</strong>.
          </p>
          <GuideLink
            section="finishing-the-setup"
            label="Finishing the setup"
          />
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
