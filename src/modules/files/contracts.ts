export interface AttachmentView {
  id: string
  taskId: string
  filename: string
  size: number
  contentType: string
  createdAt: number
}

export interface TaskAttachments {
  /** False when the installation has no FILES bucket. */
  enabled: boolean
  attachments: AttachmentView[]
}
