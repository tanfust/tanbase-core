import { CircleAlertIcon } from "lucide-react"

import { siteConfig } from "@/lib/site"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { InstallationProblem } from "@/modules/auth/installation"

const guide = `${siteConfig.sourceRepository}/blob/main/docs/DEPLOYMENT.md#importing-the-repository-from-the-dashboard`

/**
 * Says what an unfinished deployment is missing, so its owner knows the one
 * step to take (ADR-0021). Sign-in cannot work until it is done.
 */
export function SetupNotice({
  problem,
}: {
  problem: InstallationProblem | null
}) {
  if (!problem) return null
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
        <p>
          <a
            className="underline underline-offset-4"
            href={guide}
            rel="noreferrer"
            target="_blank"
          >
            How to finish the deployment
          </a>
        </p>
      </AlertDescription>
    </Alert>
  )
}
