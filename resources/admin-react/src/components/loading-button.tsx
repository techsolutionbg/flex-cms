import { LoaderCircle } from "lucide-react"
import { Children, cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactNode } from "react"
import { t } from "@/lib/admin-i18n"

function localizeButtonContent(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return t(child)
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children !== undefined) {
      return cloneElement(child, {
        children: localizeButtonContent(child.props.children),
      })
    }
    return child
  })
}

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
      {localizeButtonContent(children)}
    </button>
  )
}
