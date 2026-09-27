import { AsyncLocalStorage } from "node:async_hooks"

export interface RequestContext {
  /** Cloudflare Ray ID when present, so logs correlate with Workers Logs. */
  requestId: string
  /** Per-response CSP nonce for server-rendered inline scripts. */
  nonce: string
  /** The origin this request arrived on, such as https://example.workers.dev. */
  origin: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T
): T {
  return storage.run(context, callback)
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore()
}

const requestCaches = new WeakMap<
  RequestContext,
  Map<string, Promise<unknown>>
>()

/**
 * Runs `compute` once per request for each key and shares its promise with
 * later callers in the same request, so a server render that asks for the
 * same thing from several loaders pays for it once. Outside a request it
 * always runs. A rejected promise is dropped, so the next caller retries.
 */
export function memoizeForRequest<T>(
  key: string,
  compute: () => Promise<T>
): Promise<T> {
  const context = storage.getStore()
  if (!context) return compute()

  let cache = requestCaches.get(context)
  if (!cache) {
    cache = new Map()
    requestCaches.set(context, cache)
  }
  const existing = cache.get(key)
  if (existing) return existing as Promise<T>

  const pending = compute()
  cache.set(key, pending)
  pending.catch(() => {
    if (cache.get(key) === pending) cache.delete(key)
  })
  return pending
}
