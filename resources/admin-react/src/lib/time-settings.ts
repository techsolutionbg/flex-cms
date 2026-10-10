import { configure } from "@/lib/flex-time"

type GeneralTimeSettings = { date_format?: string; time_format?: string }

// The admin interface is Bulgarian; only the date and time formats come from the general settings.
export function applyTimeSettings(settings: GeneralTimeSettings | undefined): void {
  configure({ locale: "bg", dateFormat: settings?.date_format, timeFormat: settings?.time_format })
}

export async function loadTimeSettings(): Promise<void> {
  try {
    const response = await fetch("/api/admin/settings/general", {
      credentials: "include",
      signal: AbortSignal.timeout(10000),
    })
    if (response.ok) applyTimeSettings((await response.json()).settings)
  } catch {
    // The default format (d.m.Y H:i) stays in use.
  }
}
