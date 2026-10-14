import type { InputHTMLAttributes } from "react"
import { forwardRef, useId } from "react"
import { cn } from "@/lib/utils"
import { t } from "@/lib/admin-i18n"

export type FilterFieldProps = {
  label: string
  hideLabel?: boolean
  className?: string
  inputClassName?: string
} & InputHTMLAttributes<HTMLInputElement>

export const FilterField = forwardRef<HTMLInputElement, FilterFieldProps>(function FilterField(
  { label, hideLabel, className, inputClassName, id, ...inputProps },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <label className={cn("react-filter-field", className)} htmlFor={inputId}>
      {hideLabel ? (
        <span className="react-filter-field-visually-hidden">{t(label)}</span>
      ) : (
        <span>{t(label)}</span>
      )}
      <input ref={ref} id={inputId} className={inputClassName} {...inputProps} />
    </label>
  )
})
