import { useId, type ChangeEvent } from "react"

type CheckboxFieldProps = {
  checked: boolean
  label: string
  description?: string
  disabled?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function CheckboxField({
  checked,
  label,
  description,
  disabled,
  onChange,
}: CheckboxFieldProps) {
  const descriptionId = useId()
  return (
    <label className="react-checkbox-field">
      <span className="react-switch-control">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          aria-describedby={description ? descriptionId : undefined}
        />
        <span className="react-switch-track" aria-hidden="true">
          <span className="react-switch-thumb" />
        </span>
      </span>
      <span className="react-checkbox-label">{label}</span>
      {description && <small id={descriptionId}>{description}</small>}
    </label>
  )
}
