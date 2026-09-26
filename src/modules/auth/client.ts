import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import { createAuthClient } from "better-auth/react"

// oauthProviderClient() forwards the signed OAuth query of the current page
// with sign-in and consent requests, so an MCP client's authorization resumes
// after the user signs in.
export const authClient = createAuthClient({
  plugins: [oauthProviderClient()],
})
