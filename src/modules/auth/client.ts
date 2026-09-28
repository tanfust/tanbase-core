import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import type { BetterAuthClientPlugin } from "better-auth/client"
import { createAuthClient } from "better-auth/react"

import { edgeErrorResponse } from "./errors"

// Turns Cloudflare's own error page for a Worker over its CPU limit into an
// auth error the forms can show; see edgeErrorResponse.
const edgeErrors = {
  id: "edge-errors",
  fetchPlugins: [
    {
      id: "edge-errors",
      name: "Cloudflare edge errors",
      hooks: { onResponse: ({ response }) => edgeErrorResponse(response) },
    },
  ],
} satisfies BetterAuthClientPlugin

// oauthProviderClient() forwards the signed OAuth query of the current page
// with sign-in and consent requests, so an MCP client's authorization resumes
// after the user signs in.
export const authClient = createAuthClient({
  plugins: [oauthProviderClient(), edgeErrors],
})
