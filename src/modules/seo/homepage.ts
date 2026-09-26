import { canonicalUrl, siteConfig } from "@/lib/site"

/**
 * Homepage copy, shared by the rendered page and its Markdown representation
 * so the two cannot drift apart.
 */
export const homepage = {
  eyebrow: "TanStack Start on Cloudflare Workers",
  title: "A task board that proves the whole stack works.",
  summary:
    "Server rendering, sessions, relational data, and a responsive app shell—running together in one open-source Worker.",
  signIn: { label: "Sign in", path: "/login" },
  getStarted: { label: "Get started", path: "/sign-up" },
  primaryAction: { label: "Create your board", path: "/sign-up" },
  secondaryAction: { label: "Open the app", path: "/app" },
  features: [
    {
      key: "worker",
      title: "One Worker",
      description: "TanStack Start SSR and static assets share one deploy.",
    },
    {
      key: "database",
      title: "D1 ownership",
      description: "Projects and tasks stay behind user-scoped repositories.",
    },
    {
      key: "auth",
      title: "Better Auth",
      description: "Verified email, revocable sessions, and password recovery.",
    },
    {
      key: "board",
      title: "Working product",
      description: "A responsive project board instead of disconnected demos.",
    },
  ],
} as const

/** The homepage as Markdown, for clients that ask for `text/markdown`. */
export function createHomepageMarkdown(): string {
  const link = ({ label, path }: { label: string; path: string }) =>
    `[${label}](${canonicalUrl(path)})`

  return [
    "---",
    `title: ${siteConfig.name}`,
    `description: ${siteConfig.description}`,
    `url: ${canonicalUrl()}`,
    "---",
    "",
    `# ${homepage.title}`,
    "",
    homepage.eyebrow,
    "",
    homepage.summary,
    "",
    `- ${link(homepage.primaryAction)}`,
    `- ${link(homepage.secondaryAction)}`,
    `- ${link(homepage.signIn)}`,
    "",
    ...homepage.features.flatMap(({ title, description }) => [
      `## ${title}`,
      "",
      description,
      "",
    ]),
  ].join("\n")
}
