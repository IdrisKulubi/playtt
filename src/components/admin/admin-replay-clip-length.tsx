"use client"

import { CheckIcon } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { GroupedSection } from "@/components/admin/admin-grouped"
import type { ReplayClipSettings } from "@/server/replays/clip-settings"

const PRESETS = [20, 30, 40, 50, 60]

export function AdminReplayClipLength({
  settings,
  canManage,
}: {
  settings: ReplayClipSettings
  canManage: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(String(settings.clipDurationSeconds))
  const [saving, setSaving] = useState(false)

  const value = Number(draft)
  const valid =
    Number.isInteger(value) && value >= settings.minSeconds && value <= settings.maxSeconds
  const changed = valid && value !== settings.clipDurationSeconds
  const presets = PRESETS.filter((seconds) => seconds >= settings.minSeconds && seconds <= settings.maxSeconds)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!changed) return
    setSaving(true)
    try {
      const response = await fetch("/api/admin/replay-clip-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipDurationSeconds: value }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        toast.error(payload.message ?? "Couldn't save the clip length.")
        return
      }
      toast.success(`New replays will be ${value} seconds long.`)
      router.refresh()
    } catch {
      toast.error("Couldn't reach PlayTT. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <GroupedSection
        header="Clip length"
        footer={
          canManage
            ? `Each replay keeps the ${valid ? value - settings.postRollSeconds : settings.preRollSeconds} seconds before the tap and ${settings.postRollSeconds} after. Longer clips take longer to upload, so they reach the TV a little later. Applies to new taps only.`
            : "Only catalog managers can change the clip length."
        }
      >
        {presets.map((seconds) => {
          const selected = valid && value === seconds
          return (
            <li key={seconds}>
              <button
                type="button"
                onClick={() => setDraft(String(seconds))}
                disabled={!canManage || saving}
                aria-pressed={selected}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-[15px] transition-colors active:bg-muted/60 disabled:opacity-60"
              >
                <span>{seconds} seconds</span>
                {selected ? <CheckIcon className="size-4 text-primary" weight="bold" aria-hidden="true" /> : null}
              </button>
            </li>
          )
        })}
        <li className="flex items-center justify-between gap-4 px-4 py-2.5">
          <label htmlFor="clip-length" className="text-[15px]">
            Custom
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="clip-length"
              type="number"
              inputMode="numeric"
              min={settings.minSeconds}
              max={settings.maxSeconds}
              step={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!canManage || saving}
              aria-invalid={!valid}
              className="w-20 rounded-lg bg-muted/60 px-2.5 py-1.5 text-right text-[15px] tabular-nums outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            <span className="text-[15px] text-muted-foreground">sec</span>
          </div>
        </li>
      </GroupedSection>

      {canManage ? (
        <div className="flex items-center justify-end gap-4 px-4">
          {!valid ? (
            <span className="text-[13px] text-destructive">
              Enter a whole number from {settings.minSeconds} to {settings.maxSeconds}.
            </span>
          ) : null}
          {changed ? (
            <button
              type="button"
              className="text-[15px] text-muted-foreground"
              onClick={() => setDraft(String(settings.clipDurationSeconds))}
              disabled={saving}
            >
              Reset
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!changed || saving}
            className="h-10 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-transform duration-100 active:scale-[0.97] disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save length"}
          </button>
        </div>
      ) : null}
    </form>
  )
}
