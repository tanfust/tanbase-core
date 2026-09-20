import { CheckSquare2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

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
        <CheckSquare2Icon aria-hidden="true" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-heading text-sm font-semibold">
            TanBase Core
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            Tasks on Cloudflare
          </span>
        </span>
      )}
    </span>
  )
}
