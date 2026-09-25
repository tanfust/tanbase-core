import { useCallback, useEffect, useRef, useState } from "react"

import { Field, FieldError } from "@/components/ui/field"

const scriptUrl =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

interface TurnstileRenderOptions {
  sitekey: string
  theme: "light" | "dark"
  size: "flexible"
  callback: (token: string) => void
  "expired-callback": () => void
  "error-callback": () => void
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)

  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = scriptUrl
    script.async = true
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("Turnstile did not initialize"))
    script.onerror = () => {
      scriptPromise = null
      script.remove()
      reject(new Error("Turnstile failed to load"))
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}

/**
 * Renders a Cloudflare Turnstile challenge when a site key is configured and
 * exposes the single-use token for protected Better Auth calls. Call reset()
 * after every protected request, successful or not.
 */
export function useTurnstile(siteKey: string | null) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!siteKey || !container) return

    let cancelled = false
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return
        widgetRef.current = turnstile.render(container, {
          sitekey: siteKey,
          theme: document.documentElement.classList.contains("dark")
            ? "dark"
            : "light",
          size: "flexible",
          callback: (value) => {
            setFailed(false)
            setToken(value)
          },
          "expired-callback": () => setToken(null),
          "error-callback": () => {
            setToken(null)
            setFailed(true)
          },
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      if (widgetRef.current) window.turnstile?.remove(widgetRef.current)
      widgetRef.current = null
    }
  }, [siteKey])

  const reset = useCallback(() => {
    setToken(null)
    if (widgetRef.current) window.turnstile?.reset(widgetRef.current)
  }, [])

  return {
    enabled: siteKey !== null,
    failed,
    containerRef,
    reset,
    /** True when the request may be sent: no challenge, or a solved one. */
    ready: siteKey === null || token !== null,
    /** Pass as Better Auth fetchOptions on protected client calls. */
    fetchOptions: token
      ? { headers: { "x-captcha-response": token } }
      : undefined,
  }
}

export type TurnstileState = ReturnType<typeof useTurnstile>

export function TurnstileField({ captcha }: { captcha: TurnstileState }) {
  if (!captcha.enabled) return null

  return (
    <Field>
      <div ref={captcha.containerRef} className="min-h-16 w-full" />
      {captcha.failed && (
        <FieldError>
          The security check could not load. Refresh the page, or allow
          challenges.cloudflare.com, then try again.
        </FieldError>
      )}
    </Field>
  )
}
