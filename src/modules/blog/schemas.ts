import { z } from "zod"

import { postSlugPattern } from "./contracts"

export const blogPostInputSchema = z.object({
  slug: z.string().max(100).regex(postSlugPattern),
})
