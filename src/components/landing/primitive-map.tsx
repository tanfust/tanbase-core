import { ServerIcon } from "lucide-react"

import { homepage } from "@/modules/seo/homepage"

const { worker, items } = homepage.primitives

/**
 * The Worker at the top of a rail, with every feature hanging off it: the
 * page's one diagram of how the primitives connect. Each item draws its own
 * rail segment, so the line starts at the Worker and ends at the last node.
 */
export function PrimitiveMap() {
  return (
    <div>
      <div className="flex gap-4 rounded-2xl bg-primary p-4 text-primary-foreground shadow-md shadow-primary/20 selection:bg-primary-foreground selection:text-primary sm:p-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
          <ServerIcon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-semibold">{worker.name}</span>
            <code className="font-mono text-sm text-primary-foreground/85">
              {worker.entry}
            </code>
          </p>
          <p className="text-sm leading-6 text-primary-foreground/85">
            {worker.description}
          </p>
        </div>
      </div>
      <ol className="ms-8 pt-2 sm:ms-9">
        {items.map(({ feature, product, bindings }) => (
          <li
            key={feature}
            className="relative grid gap-x-4 gap-y-1.5 py-3 ps-6 before:absolute before:start-0 before:top-0 before:h-full before:w-px before:bg-primary/30 first:before:-top-2 first:before:h-[calc(100%+0.5rem)] last:before:h-[calc(1.2rem+5px)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline"
          >
            <span
              aria-hidden="true"
              className="absolute -start-[4.5px] top-[1.2rem] size-2.5 rounded-full bg-primary ring-4 ring-background"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{feature}</span>
              <span className="text-sm text-muted-foreground">{product}</span>
            </div>
            <span className="flex flex-wrap gap-1.5 sm:justify-end">
              {bindings.map((name) => (
                <code
                  key={name}
                  className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
                >
                  {name}
                </code>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
