import { ShieldCheckIcon, TrendingUpIcon } from "lucide-react"

import { homepage } from "@/modules/seo/homepage"

const {
  allowances,
  allowancesCaption,
  allowancesCheckedOn,
  risks,
  guardrails,
} = homepage.cost

export function AllowanceTable() {
  return (
    <table className="w-full text-sm">
      <caption className="mb-3 text-start">
        <span className="font-medium">{allowancesCaption}</span>
        <span className="text-muted-foreground"> · {allowancesCheckedOn}</span>
      </caption>
      <tbody className="border-t">
        {allowances.map(({ product, note, included }) => (
          <tr key={product} className="border-b">
            <th
              scope="row"
              className="w-36 py-3 pe-4 text-start align-baseline font-medium sm:w-auto sm:whitespace-nowrap"
            >
              {product}
              {note && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {note}
                </span>
              )}
            </th>
            <td className="py-3 text-start align-baseline text-muted-foreground tabular-nums sm:text-end">
              {included}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CostList({
  heading,
  items,
  icon: Icon,
}: {
  heading: string
  items: readonly string[]
  icon: typeof ShieldCheckIcon
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{heading}</h3>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2.5 text-sm leading-6 text-muted-foreground"
          >
            <Icon
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-primary"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CostLists() {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <CostList {...risks} icon={TrendingUpIcon} />
      <CostList {...guardrails} icon={ShieldCheckIcon} />
    </div>
  )
}
