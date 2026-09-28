import type { ComponentProps, FormEvent, ReactNode } from "react"
import {
  createFormHook,
  createFormHookContexts,
  revalidateLogic,
  useStore,
} from "@tanstack/react-form"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()

export { useFieldContext }

/**
 * Validates on the first submit, then on every change, like the hand-written
 * forms did: no errors while someone types into an untouched form.
 */
export const validateOnSubmit = revalidateLogic()

interface FieldErrorLike {
  message?: string
}

function toFieldErrors(errors: readonly unknown[]): FieldErrorLike[] {
  return errors.flatMap((error) => {
    if (typeof error === "string") return [{ message: error }]
    if (error && typeof error === "object" && "message" in error) {
      return [error as FieldErrorLike]
    }
    return []
  })
}

/**
 * The field's state for accessible markup: whether to show its errors, the
 * errors themselves, and the IDs that `aria-describedby` points at.
 */
export function useFieldStatus(id: string, hasDescription: boolean) {
  const field = useFieldContext<unknown>()
  const meta = useStore(field.store, (state) => state.meta)
  const invalid = meta.isTouched && !meta.isValid
  const errorId = `${id}-error`
  const descriptionId = `${id}-description`
  const describedBy =
    [hasDescription && descriptionId, invalid && errorId]
      .filter(Boolean)
      .join(" ") || undefined
  return {
    invalid,
    errors: toFieldErrors(meta.errors),
    errorId,
    descriptionId,
    describedBy,
  }
}

interface LabelledFieldProps {
  id: string
  label: ReactNode
  /** Shown beside the label, such as a "Forgot password?" link. */
  labelAction?: ReactNode
  description?: ReactNode
}

function FieldLabelRow({
  id,
  label,
  labelAction,
}: Pick<LabelledFieldProps, "id" | "label" | "labelAction">) {
  if (!labelAction) return <FieldLabel htmlFor={id}>{label}</FieldLabel>
  return (
    <div className="flex items-center justify-between gap-3">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {labelAction}
    </div>
  )
}

type InputProps = Omit<
  ComponentProps<typeof Input>,
  "id" | "name" | "value" | "onChange" | "onBlur" | "aria-invalid"
>

function TextField({
  id,
  label,
  labelAction,
  description,
  ...props
}: LabelledFieldProps & InputProps) {
  const field = useFieldContext<string>()
  const value = useStore(field.store, (state) => state.value)
  const status = useFieldStatus(id, Boolean(description))
  return (
    <Field data-invalid={status.invalid || undefined}>
      <FieldLabelRow id={id} label={label} labelAction={labelAction} />
      <Input
        {...props}
        id={id}
        name={field.name}
        value={value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={status.invalid || undefined}
        aria-describedby={status.describedBy}
      />
      {description && (
        <FieldDescription id={status.descriptionId}>
          {description}
        </FieldDescription>
      )}
      {status.invalid && (
        <FieldError id={status.errorId} errors={status.errors} />
      )}
    </Field>
  )
}

type TextareaProps = Omit<
  ComponentProps<typeof Textarea>,
  "id" | "name" | "value" | "onChange" | "onBlur" | "aria-invalid"
>

function TextareaField({
  id,
  label,
  description,
  ...props
}: Omit<LabelledFieldProps, "labelAction"> & TextareaProps) {
  const field = useFieldContext<string>()
  const value = useStore(field.store, (state) => state.value)
  const status = useFieldStatus(id, Boolean(description))
  return (
    <Field data-invalid={status.invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        {...props}
        id={id}
        name={field.name}
        value={value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={status.invalid || undefined}
        aria-describedby={status.describedBy}
      />
      {description && (
        <FieldDescription id={status.descriptionId}>
          {description}
        </FieldDescription>
      )}
      {status.invalid && (
        <FieldError id={status.errorId} errors={status.errors} />
      )}
    </Field>
  )
}

/** A submit button that is busy while the form's `onSubmit` runs. */
function SubmitButton({
  children,
  pendingLabel,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & { pendingLabel: ReactNode }) {
  const form = useFormContext()
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  return (
    <Button {...props} type="submit" disabled={props.disabled || isSubmitting}>
      {isSubmitting && <Spinner data-icon="inline-start" />}
      {isSubmitting ? pendingLabel : children}
    </Button>
  )
}

/**
 * The app's form hook. Fields render the shadcn/ui `Field` markup with
 * labels, descriptions, `aria-invalid`, and errors linked through
 * `aria-describedby`.
 */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextareaField },
  formComponents: { SubmitButton },
})

/** Submits through the form without the browser's own submission. */
export function submitHandler(form: { handleSubmit: () => Promise<void> }) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    void form.handleSubmit()
  }
}
