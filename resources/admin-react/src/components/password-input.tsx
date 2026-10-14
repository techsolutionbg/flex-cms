import { Eye, EyeOff } from "lucide-react"
import { useState, type InputHTMLAttributes } from "react"
import { t } from "@/lib/admin-i18n"

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  variant?: "admin" | "ui"
}

/** Password input with an accessible control for toggling password visibility. */
export function PasswordInput({
  variant = "admin",
  className = "",
  ...inputProps
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={`password-field-control${variant === "ui" ? " is-ui" : ""}`}>
      <input
        {...inputProps}
        type={visible ? "text" : "password"}
        className={`password-field-input${className ? ` ${className}` : ""}`}
      />
      <button
        type="button"
        className="password-field-toggle"
        aria-label={visible ? t("Hide password") : t("Show password")}
        aria-pressed={visible}
        title={visible ? t("Hide password") : t("Show password")}
        disabled={inputProps.disabled}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
  )
}
