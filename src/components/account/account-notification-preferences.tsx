"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

type PreferenceKey = "sessionReminders" | "replayReady" | "bookingUpdates"

type NotificationPreferences = Record<PreferenceKey, boolean>

const storageKey = "playtt-notification-preferences"

const defaultPreferences: NotificationPreferences = {
  sessionReminders: true,
  replayReady: true,
  bookingUpdates: true,
}

const preferenceRows: {
  key: PreferenceKey
  title: string
  description: string
}[] = [
  {
    key: "sessionReminders",
    title: "Session reminders",
    description: "Get a heads-up before your booking starts.",
  },
  {
    key: "replayReady",
    title: "Replay ready",
    description: "Know when a clip from your session is available.",
  },
  {
    key: "bookingUpdates",
    title: "Booking updates",
    description: "Changes, payments, and confirmations.",
  },
]

export function AccountNotificationPreferences() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)

    if (saved) {
      try {
        setPreferences({ ...defaultPreferences, ...JSON.parse(saved) })
      } catch {
        setPreferences(defaultPreferences)
      }
    }

    setLoaded(true)
  }, [])

  function updatePreference(key: PreferenceKey, value: boolean) {
    const next = { ...preferences, [key]: value }

    setPreferences(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
    toast.success("Notification preference saved.")
  }

  return (
    <section className="quiet-panel max-w-3xl p-5 sm:p-6">
      <p className="text-sm leading-7 text-muted-foreground">
        Choose what you want to hear about. Push delivery is coming soon; these
        preferences are saved in this browser for now, matching the current
        mobile app behavior.
      </p>

      <div className="mt-5 rounded-[var(--radius-field)] border border-border bg-card px-4">
        {preferenceRows.map((row) => (
          <label
            key={row.key}
            className="flex cursor-pointer items-center justify-between gap-4 border-b border-border py-4 last:border-b-0"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {row.title}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {row.description}
              </span>
            </span>
            <input
              type="checkbox"
              className="size-5 rounded border-border accent-primary"
              checked={preferences[row.key]}
              disabled={!loaded}
              onChange={(event) => updatePreference(row.key, event.target.checked)}
            />
          </label>
        ))}
      </div>
    </section>
  )
}
