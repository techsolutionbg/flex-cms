import { LoaderCircle } from "lucide-react"
import type { ButtonHTMLAttributes, ReactNode } from "react"

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  children: ReactNode
}

export function LoadingButton({ loading = false, disabled = false, children, className = "", ...props }: LoadingButtonProps) {
  return <button {...props} className={`react-loading-button ${className}`} disabled={loading || disabled}>{loading && <LoaderCircle className="react-button-spinner" />}{children}</button>
}
