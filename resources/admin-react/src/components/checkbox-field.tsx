import type { ChangeEvent } from "react"

type CheckboxFieldProps = {
  checked: boolean
  label: string
  description?: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function CheckboxField({ checked, label, description, onChange }: CheckboxFieldProps) {
  return (
    <label className="react-checkbox-field">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="react-checkbox-label">{label}</span>
      {description && <small>{description}</small>}
    </label>
  )
}
