import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileIcon, PaperclipIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import type { AttachmentView } from "@/modules/files/contracts"
import { deleteAttachment } from "@/modules/files/functions"
import {
  allowedAttachmentTypes,
  formatBytes,
  isAllowedAttachmentType,
  maxAttachmentBytes,
  maxAttachmentsPerTask,
} from "@/modules/files/limits"
import {
  taskAttachmentsQueryKey,
  taskAttachmentsQueryOptions,
} from "@/modules/files/queries"

async function uploadAttachment(taskId: string, file: File) {
  const response = await fetch(
    `/api/tasks/${encodeURIComponent(taskId)}/attachments`,
    {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        "X-Attachment-Name": encodeURIComponent(file.name),
      },
      body: file,
    }
  )
  if (!response.ok) {
    const problem = await response
      .json<{ message?: string }>()
      .catch(() => null)
    throw new Error(problem?.message ?? "The file could not be uploaded.")
  }
  return response.json<AttachmentView>()
}

function validate(file: File): string | null {
  if (file.size === 0) return "Choose a non-empty file."
  if (file.size > maxAttachmentBytes) return "Files can be at most 10 MB."
  if (!isAllowedAttachmentType(file.type)) {
    return "This file type is not supported."
  }
  return null
}

export function TaskAttachments({ taskId }: { taskId: string }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const query = useQuery(taskAttachmentsQueryOptions(taskId))
  const key = taskAttachmentsQueryKey(taskId)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(taskId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (uploadError) =>
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The file could not be uploaded."
      ),
  })

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      deleteAttachment({ data: { attachmentId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: () =>
      toast.add({
        type: "error",
        title: "Attachment was not deleted",
        description: "Try again.",
      }),
  })

  if (query.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading attachments…
      </div>
    )
  }
  if (query.isError) {
    return <FieldError>Attachments could not be loaded.</FieldError>
  }
  if (!query.data.enabled) {
    return (
      <FieldDescription>
        File attachments are not enabled on this installation.
      </FieldDescription>
    )
  }

  const { attachments } = query.data
  const full = attachments.length >= maxAttachmentsPerTask

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const problem = validate(file)
    setError(problem)
    if (!problem) uploadMutation.mutate(file)
  }

  return (
    <section aria-labelledby="task-attachments" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel id="task-attachments">Attachments</FieldLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploadMutation.isPending || full}
          onClick={() => inputRef.current?.click()}
        >
          {uploadMutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PaperclipIcon data-icon="inline-start" />
          )}
          {uploadMutation.isPending ? "Uploading…" : "Attach file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a file to attach"
          accept={allowedAttachmentTypes.join(",")}
          onChange={choose}
        />
      </div>
      {attachments.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <FileIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <a
                href={`/api/attachments/${attachment.id}`}
                download={attachment.filename}
                className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
              >
                {attachment.filename}
              </a>
              <span className="shrink-0 text-muted-foreground">
                {formatBytes(attachment.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${attachment.filename}`}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(attachment.id)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <FieldDescription>
        {full
          ? `This task has the maximum of ${maxAttachmentsPerTask} attachments.`
          : "Up to 10 MB each: images, PDF, text, CSV, Markdown, Word, or Excel."}
      </FieldDescription>
      {error && <FieldError>{error}</FieldError>}
    </section>
  )
}
