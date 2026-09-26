import { canonicalUrl, siteConfig, sourceFileUrl } from "@/lib/site"

interface InternalAction {
  label: string
  path: string
}

interface ExternalAction {
  label: string
  href: string
}

export interface Allowance {
  product: string
  /** Set when the allowance is not specific to Workers Paid. */
  note?: string
  included: string
}

export interface Primitive {
  feature: string
  product: string
  /** Binding, secret, or route names from `wrangler.jsonc` and the Worker. */
  bindings: readonly string[]
}

/** Checked against Cloudflare's pricing pages on 2026-09-26. */
const allowances: readonly Allowance[] = [
  {
    product: "Workers",
    included: "10M requests and 30M CPU ms a month",
  },
  {
    product: "D1",
    included: "25B rows read and 50M written a month, 5 GB stored",
  },
  {
    product: "Durable Objects",
    included: "1M requests and 400K GB-s a month",
  },
  {
    product: "R2",
    note: "Free tier on every plan",
    included: "10 GB stored, 1M Class A and 10M Class B operations a month",
  },
  { product: "Queues", included: "1M operations a month" },
  {
    product: "Workers AI",
    note: "Free tier on every plan",
    included: "10,000 Neurons a day",
  },
  { product: "Email Service", included: "3,000 emails a month" },
]

/**
 * Homepage copy, shared by the rendered page and its Markdown representation
 * so the two cannot drift apart. Every claim here describes what production
 * runs today; planned work is labelled as planned.
 */
export const homepage = {
  title: "A task board that proves the whole stack works.",
  summary:
    "An open-source TanStack Start foundation for Cloudflare Workers: auth, data, files, realtime, jobs, AI, and an MCP server in one Worker you fork and own.",
  source: {
    label: "Get the source",
    href: siteConfig.sourceRepository,
  } satisfies ExternalAction,
  demo: {
    label: "Try the live board",
    path: "/sign-up",
  } satisfies InternalAction,
  signIn: { label: "Sign in", path: "/login" } satisfies InternalAction,
  primitives: {
    heading: "Every primitive powers a real feature",
    intro:
      "Each feature below runs in production on core.tanbase.dev, wired to the same Worker. The chips name the binding, secret, route, or config key it uses.",
    worker: {
      name: "One Worker",
      entry: "src/server.ts",
      description:
        "Server rendering, static assets, the cron handler, the queue consumer, the Workflow, and the Durable Object ship in one deploy.",
    },
    items: [
      {
        feature: "Projects and tasks",
        product: "D1 with Drizzle",
        bindings: ["DB"],
      },
      {
        feature: "Accounts and sessions",
        product: "Better Auth on D1",
        bindings: ["DB"],
      },
      {
        feature: "Bot checks on sign-up and sign-in",
        product: "Turnstile",
        bindings: ["TURNSTILE_SECRET_KEY"],
      },
      {
        feature: "Abuse limits on auth and AI",
        product: "Rate Limiting",
        bindings: ["AUTH_LIMITER", "AI_LIMITER"],
      },
      {
        feature: "Task attachments",
        product: "R2",
        bindings: ["FILES"],
      },
      {
        feature: "Live board across devices",
        product: "Durable Objects with WebSocket Hibernation",
        bindings: ["BOARD"],
      },
      {
        feature: "Due-date reminders",
        product: "Cron Triggers and Queues",
        bindings: ["EMAIL_QUEUE"],
      },
      {
        feature: "Verification and reminder email",
        product: "Email Service",
        bindings: ["EMAIL"],
      },
      {
        feature: "Task breakdown into subtasks",
        product: "Workflows",
        bindings: ["BREAKDOWN"],
      },
      {
        feature: "Subtask suggestions",
        product: "Workers AI through AI Gateway",
        bindings: ["AI"],
      },
      {
        feature: "Task tools for Claude and other agents",
        product: "MCP server with OAuth 2.1",
        bindings: ["/mcp"],
      },
      {
        feature: "Structured request logs",
        product: "Workers Logs",
        bindings: ["observability"],
      },
    ] satisfies readonly Primitive[],
  },
  cost: {
    heading: "Sized for one $5 plan",
    intro:
      "The target: the public demo runs on Workers Paid at $5 a month, with its usage inside the included allowances. Static assets and egress are free.",
    allowancesCaption: "Included with Workers Paid",
    allowancesCheckedOn: "Checked September 2026",
    allowances,
    risks: {
      heading: "What could push it past $5",
      items: [
        "Workers AI beyond the free daily Neurons",
        "Abuse of the public demo: sign-ups, uploads, and AI calls",
      ],
    },
    guardrails: {
      heading: "Guardrails running now",
      items: [
        "Turnstile and per-IP rate limits on auth",
        "A per-user daily AI quota and burst limit",
        "A 10 MB upload cap with a file type allowlist",
      ],
    },
  },
  deploy: {
    heading: "Deploy your own",
    intro:
      "Clone the repository and run the guided installer. It provisions D1, R2, and Queues in your Cloudflare account, generates the auth secret, deploys the Worker, and runs production smoke checks.",
    commands: [
      `git clone ${siteConfig.sourceRepository}.git`,
      "cd tanbase-core",
      "pnpm install --frozen-lockfile",
      "pnpm run setup",
    ],
    requirements:
      "Needs Node.js 22.13 or later, pnpm 10.11.1, and a Cloudflare account.",
    guide: {
      label: "Read the install guide",
      href: sourceFileUrl("docs/INSTALLING.md"),
    } satisfies ExternalAction,
    oneClick: "A one-click Deploy to Cloudflare button is on the roadmap.",
  },
  footer: {
    license: { label: "MIT license", href: sourceFileUrl("LICENSE") },
    links: [
      { label: "Source", href: siteConfig.sourceRepository },
      { label: "llms.txt", href: "/llms.txt" },
      { label: "Status", href: sourceFileUrl("docs/STATUS.md") },
    ],
  },
} as const

/** The homepage as Markdown, for clients that ask for `text/markdown`. */
export function createHomepageMarkdown(): string {
  const internal = ({ label, path }: InternalAction) =>
    `[${label}](${canonicalUrl(path)})`
  const external = ({ label, href }: ExternalAction) => `[${label}](${href})`
  const { primitives, cost, deploy } = homepage

  return [
    "---",
    `title: ${siteConfig.name}`,
    `description: ${siteConfig.description}`,
    `url: ${canonicalUrl()}`,
    "---",
    "",
    `# ${homepage.title}`,
    "",
    homepage.summary,
    "",
    `- ${external(homepage.source)}`,
    `- ${internal(homepage.demo)}`,
    `- ${internal(homepage.signIn)}`,
    "",
    `## ${primitives.heading}`,
    "",
    primitives.intro,
    "",
    `${primitives.worker.name} (\`${primitives.worker.entry}\`): ${primitives.worker.description}`,
    "",
    "| Feature | Built on | Wired as |",
    "| --- | --- | --- |",
    ...primitives.items.map(
      ({ feature, product, bindings }) =>
        `| ${feature} | ${product} | ${bindings.map((name) => `\`${name}\``).join(", ")} |`
    ),
    "",
    `## ${cost.heading}`,
    "",
    cost.intro,
    "",
    `${cost.allowancesCaption} (${cost.allowancesCheckedOn.toLowerCase()}):`,
    "",
    "| Product | Included |",
    "| --- | --- |",
    ...cost.allowances.map(
      ({ product, note, included }) =>
        `| ${product} | ${included}${note ? ` (${note.toLowerCase()})` : ""} |`
    ),
    "",
    `${cost.risks.heading}:`,
    "",
    ...cost.risks.items.map((item) => `- ${item}`),
    "",
    `${cost.guardrails.heading}:`,
    "",
    ...cost.guardrails.items.map((item) => `- ${item}`),
    "",
    `## ${deploy.heading}`,
    "",
    deploy.intro,
    "",
    "```sh",
    ...deploy.commands,
    "```",
    "",
    `${deploy.requirements} ${external(deploy.guide)}. ${deploy.oneClick}`,
    "",
  ].join("\n")
}
