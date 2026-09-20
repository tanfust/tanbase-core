import * as React from "react"

export type Theme = "light" | "dark" | "system"

const storageKey = "tanbase-theme"

const ThemeContext = React.createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({ theme: "system", setTheme: () => undefined })

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system")

  React.useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    const next =
      saved === "light" || saved === "dark" || saved === "system"
        ? saved
        : "system"
    setThemeState(next)
    applyTheme(next)
  }, [])

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const update = () => theme === "system" && applyTheme("system")
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [theme])

  const setTheme = React.useCallback((next: Theme) => {
    window.localStorage.setItem(storageKey, next)
    setThemeState(next)
    applyTheme(next)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return React.useContext(ThemeContext)
}

export const themeScript = `
try {
  const value = localStorage.getItem("${storageKey}") || "system";
  const dark = value === "dark" || (value === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
} catch {}
`
