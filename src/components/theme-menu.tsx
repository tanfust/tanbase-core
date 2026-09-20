import { LaptopIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import type { Theme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const choices: Array<{ value: Theme; label: string; icon: typeof SunIcon }> = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: LaptopIcon },
]

export function ThemeMenu() {
  const { theme, setTheme } = useTheme()
  const CurrentIcon =
    choices.find((choice) => choice.value === theme)?.icon ?? LaptopIcon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Change theme" />
        }
      >
        <CurrentIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as Theme)}
        >
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          {choices.map((choice) => (
            <DropdownMenuRadioItem key={choice.value} value={choice.value}>
              <choice.icon />
              {choice.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
