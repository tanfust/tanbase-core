import { getRequestContext } from "./request-context"

type LogFields = Record<string, unknown>

// Workers Logs indexes the fields of logged objects, so every entry is one
// object carrying the request ID of the request that produced it.
function entry(message: string, fields: LogFields) {
  return { message, requestId: getRequestContext()?.requestId, ...fields }
}

export const log = {
  info(message: string, fields: LogFields = {}) {
    console.info(entry(message, fields))
  },
  warn(message: string, fields: LogFields = {}) {
    console.warn(entry(message, fields))
  },
  error(message: string, fields: LogFields = {}) {
    console.error(entry(message, fields))
  },
}
