import { LoaderCircle } from "lucide-react"
import type { ButtonHTMLAttributes, ReactNode } from "react"

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  icon?: ReactNode
  children: ReactNode
}

export function LoadingButton({
  loading = false,
  disabled = false,
  children,
  icon,
  className = "",
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      className={`react-action-button react-loading-button ${className}`}
      disabled={loading || disabled}
      aria-busy={loading}
    >
      {loading ? <LoaderCircle className="react-button-spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}
