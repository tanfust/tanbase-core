import { useHydrated } from "@tanstack/react-router"

const options: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
}

const utcDay = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" })

// Built on first use, so it reads the time zone of the browser that renders.
let localDay: Intl.DateTimeFormat | undefined

/**
 * A timestamp's calendar day, such as "Sep 28, 2026". The Worker renders in
 * UTC, so the server's HTML and the first client render show the UTC day;
 * once hydrated, it shows the day in the browser's time zone.
 */
export function TaskDate({
  timestamp,
}: {
  timestamp: number | null | undefined
}) {
  const hydrated = useHydrated()
  if (!timestamp) return <span>—</span>
  localDay ??= new Intl.DateTimeFormat("en-US", options)
  return (
    <time
      dateTime={new Date(timestamp).toISOString()}
      className="whitespace-nowrap"
    >
      {(hydrated ? localDay : utcDay).format(timestamp)}
    </time>
  )
}
