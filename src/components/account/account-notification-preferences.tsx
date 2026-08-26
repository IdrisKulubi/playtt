"use client"

import { useCallback, useEffect, useState } from "react"
import { SpinnerGapIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/server/notifications/contract"

const preferenceRows: {
  key: NotificationPreferenceKey
  title: string
  description: string
}[] = [
  { key: "accessReady", title: "Access ready", description: "Know when your venue door code is ready to reveal." },
  { key: "accessFailed", title: "Access help", description: "Get support instructions if access needs attention." },
  { key: "sessionReminder", title: "Session reminder", description: "Get a heads-up before your booking starts." },
  { key: "sessionWarning", title: "Five-minute warning", description: "Know when five minutes remain in your session." },
  { key: "sessionEnded", title: "Session ended", description: "Receive a confirmation when venue automation completes." },
  { key: "replayReady", title: "Replay ready", description: "Know when a clip from your session is available." },
]

export function AccountNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<NotificationPreferenceKey | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/user/notification-preferences", { cache: "no-store" })
      const body = (await response.json()) as { data?: { preferences: NotificationPreferences }; message?: string }
      if (!response.ok || !body.data) throw new Error(body.message ?? "Could not load preferences.")
      setPreferences(body.data.preferences)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load preferences.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function updatePreference(key: NotificationPreferenceKey, value: boolean) {
    const previous = preferences
    setPreferences({ ...preferences, [key]: value })
    setSaving(key)
    try {
      const response = await fetch("/api/user/notification-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
      const body = (await response.json()) as { data?: { preferences: NotificationPreferences }; message?: string }
      if (!response.ok || !body.data) throw new Error(body.message ?? "Could not save preference.")
      setPreferences(body.data.preferences)
      toast.success("Notification preference saved.")
    } catch (error) {
      setPreferences(previous)
      toast.error(error instanceof Error ? error.message : "Could not save preference.")
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="quiet-panel max-w-3xl p-5 sm:p-6">
      <p className="text-sm leading-7 text-muted-foreground">
        Choose useful email and mobile push updates. Access messages link back to your authenticated booking and never contain the door code.
      </p>
      <div className="mt-5 rounded-[var(--radius-field)] border border-border bg-card px-4">
        {preferenceRows.map((row) => (
          <label key={row.key} className="flex cursor-pointer items-center justify-between gap-4 border-b border-border py-4 last:border-b-0">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{row.title}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{row.description}</span>
            </span>
            <span className="flex items-center gap-2">
              {saving === row.key ? <SpinnerGapIcon className="size-4 animate-spin text-muted-foreground" /> : null}
              <input
                type="checkbox"
                className="size-5 rounded border-border accent-primary"
                checked={preferences[row.key]}
                disabled={loading || saving !== null}
                onChange={(event) => void updatePreference(row.key, event.target.checked)}
              />
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}
