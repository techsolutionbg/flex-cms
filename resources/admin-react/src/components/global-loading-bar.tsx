import { t } from "@/lib/admin-i18n"
import { useEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { requestTracker } from "@/lib/request-tracker"

export function GlobalLoadingBar() {
  const pending = useSyncExternalStore(requestTracker.subscribe, requestTracker.snapshot, () => 0)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(pending > 0), pending > 0 ? 150 : 250)
    return () => window.clearTimeout(timer)
  }, [pending > 0])
  if (!visible) return null
  return createPortal(
    <div
      className={`admin-global-loading${pending === 0 ? " is-complete" : ""}`}
      role="progressbar"
      aria-label={t("Loading data")}
      aria-valuetext={pending > 0 ? t("Loading…") : t("Complete")}
    >
      <span />
    </div>,
    document.body,
  )
}
