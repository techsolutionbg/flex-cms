import { useEffect, useState } from "react"
import {
  formatExact,
  formatFull,
  isoUtc,
  subscribe,
  zoneName,
  type TimeStyle,
  type TimeValue,
} from "@/lib/flex-time"

/** Re-renders once a minute so relative times stay current. All instances share one timer. */
export function useMinuteTick(): void {
  const [, setTick] = useState(0)
  useEffect(() => subscribe(() => setTick((tick) => tick + 1)), [])
}

/**
 * The platform standard for showing a time: "10.10.2026 14:30 · преди 5 минути" in the viewer's zone.
 * Values without a zone are UTC. The tooltip shows the exact time and the time zone.
 */
export function DateTime({
  value,
  style = "datetime",
  empty = "—",
  className,
}: {
  value: TimeValue
  style?: TimeStyle
  empty?: string
  className?: string
}) {
  useMinuteTick()
  const iso = isoUtc(value)
  if (iso === "") return <span className={className}>{empty}</span>
  const zone = zoneName()
  return (
    <time
      dateTime={iso}
      title={formatExact(value) + (zone ? ` (${zone})` : "")}
      className={className}
    >
      {formatFull(value, style)}
    </time>
  )
}
