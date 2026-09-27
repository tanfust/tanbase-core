import { CheckSquare2Icon } from "lucide-react"

import { siteConfig } from "@/lib/site"
import { cn } from "@/lib/utils"

/**
 * The logo from `siteConfig.logo`, sized to its tile. A monochrome mark is
 * drawn through a CSS mask in the current text color, so it follows the
 * theme; any other logo is shown as it is.
 */
export function BrandMark({ className }: { className?: string }) {
  const { logo } = siteConfig
  if (!logo)
    return <CheckSquare2Icon aria-hidden="true" className={className} />
  if (!logo.monochrome) {
    return (
      <img
        src={logo.src}
        alt=""
        aria-hidden="true"
        className={cn("size-6 object-contain", className)}
      />
    )
  }
  const mask = `url("${logo.src}") center / contain no-repeat`
  return (
    <span
      aria-hidden="true"
      className={cn("size-6 bg-current", className)}
      style={{ mask, WebkitMask: mask }}
    />
  )
}

export function BrandLockup({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <BrandMark />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-heading text-sm font-semibold">
            {siteConfig.name}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {siteConfig.subtitle}
          </span>
        </span>
      )}
    </span>
  )
}
