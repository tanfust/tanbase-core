// Shared by the browser, the upload route, and the database constraint.
export const maxAttachmentBytes = 10 * 1024 * 1024
export const maxAttachmentsPerTask = 20
export const maxAttachmentNameLength = 180

// Downloads are always served as attachments with nosniff, so no type here is
// ever rendered by the site. SVG and HTML are excluded because they can run
// script when opened directly.
export const allowedAttachmentTypes = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const

export function normalizeContentType(value: string | null | undefined) {
  return (value ?? "").split(";", 1)[0].trim().toLowerCase()
}

export function isAllowedAttachmentType(value: string | null | undefined) {
  return (allowedAttachmentTypes as readonly string[]).includes(
    normalizeContentType(value)
  )
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`
  return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`
}
