import { useEffect, useState } from "react"
import { ArrowUpRightIcon, CheckIcon, CopyIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { homepage } from "@/modules/seo/homepage"

const { heading, intro, commands, requirements, guide, oneClick } =
  homepage.deploy

function CopyCommands() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <Button
      variant="ghost"
      size="xs"
      className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
      onClick={() => {
        navigator.clipboard.writeText(commands.join("\n")).then(
          () => setCopied(true),
          () => setCopied(false)
        )
      }}
    >
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopyIcon data-icon="inline-start" />
      )}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </Button>
  )
}

export function DeployPanel() {
  return (
    <section
      aria-labelledby="deploy-heading"
      className="px-4 pb-20 sm:px-6 sm:pb-28"
    >
      {/* Below lg the terminal follows the requirements, ahead of the guide
          link; at lg it spans both rows of the right column. */}
      <div className="mx-auto grid max-w-6xl gap-8 rounded-3xl bg-primary p-6 text-primary-foreground selection:bg-primary-foreground selection:text-primary sm:p-12 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-8">
        <div className="flex flex-col gap-4 lg:self-end">
          <h2
            id="deploy-heading"
            className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            {heading}
          </h2>
          <p className="text-lg leading-8 text-pretty text-primary-foreground/85">
            {intro}
          </p>
          <p className="text-sm leading-6 text-primary-foreground/85">
            {requirements}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded-2xl bg-black/25 ring-1 ring-primary-foreground/15 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <div className="flex items-center justify-between border-b border-primary-foreground/15 py-1.5 ps-4 pe-2">
            <span className="text-xs font-medium text-primary-foreground/85">
              Terminal
            </span>
            <CopyCommands />
          </div>
          {/* Narrow screens wrap long commands under a hanging indent;
              wider ones keep each command on one line. */}
          <pre className="[scrollbar-width:thin] [scrollbar-color:color-mix(in_oklch,var(--primary-foreground)_35%,transparent)_transparent] overflow-x-auto p-4 font-mono text-[0.8125rem] leading-7 [overflow-wrap:anywhere] whitespace-pre-wrap sm:p-5 sm:whitespace-pre">
            <code>
              {commands.map((command) => (
                <span
                  key={command}
                  className="block ps-[2ch] -indent-[2ch] sm:ps-0 sm:indent-0"
                >
                  <span
                    aria-hidden="true"
                    className="text-primary-foreground/75 select-none"
                  >
                    ${" "}
                  </span>
                  {command}
                </span>
              ))}
            </code>
          </pre>
        </div>
        <div className="flex flex-col items-start gap-3 lg:self-start">
          <a
            href={guide.href}
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            )}
          >
            {guide.label}
            <ArrowUpRightIcon data-icon="inline-end" />
          </a>
          <p className="text-sm text-primary-foreground/85">{oneClick.intro}</p>
          <a
            href={oneClick.action.href}
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            )}
          >
            {oneClick.action.label}
            <ArrowUpRightIcon data-icon="inline-end" />
          </a>
        </div>
      </div>
    </section>
  )
}
