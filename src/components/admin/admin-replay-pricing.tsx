"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { GroupedSection, LargeTitle, ValueRow } from "@/components/admin/admin-grouped"
import type { ReplayClipPricing } from "@/server/replays/pricing"

const EXAMPLES = [1, 5, 10, 20]

function kes(value: number) {
  return `KES ${value.toLocaleString("en-KE")}`
}

const updatedFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

export function AdminReplayPricing({
  pricing,
  canManage,
}: {
  pricing: ReplayClipPricing
  canManage: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(String(pricing.unitPriceKes))
  const [saving, setSaving] = useState(false)

  const value = Number(draft)
  const valid = Number.isInteger(value) && value >= 1 && value <= 10_000
  const changed = valid && value !== pricing.unitPriceKes
  const preview = valid ? value : pricing.unitPriceKes

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!changed) return
    setSaving(true)
    try {
      const response = await fetch("/api/admin/replay-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitPriceKes: value }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        toast.error(payload.message ?? "Couldn't save the price.")
        return
      }
      toast.success(`Clips now cost ${kes(value)} each.`)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <LargeTitle
        title={`${kes(pricing.unitPriceKes)} per clip`}
        subtitle={
          pricing.updatedAt
            ? `Last changed ${updatedFormat.format(new Date(pricing.updatedAt))}`
            : "Using the default price"
        }
      />

      <form onSubmit={save}>
        <GroupedSection
          header="Price"
          footer={
            canManage
              ? `Players choose ${pricing.minClips} to ${pricing.maxClips} clips per purchase. New prices apply to new checkouts only; payments already in progress keep their price.`
              : "Only catalog managers can change the price."
          }
        >
          <li className="flex items-center justify-between gap-4 px-4 py-2.5">
            <label htmlFor="clip-price" className="text-[15px]">
              Price per clip
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] text-muted-foreground">KES</span>
              <input
                id="clip-price"
                type="number"
                inputMode="numeric"
                min={1}
                max={10_000}
                step={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={!canManage || saving}
                aria-invalid={!valid}
                className="w-24 rounded-lg bg-muted/60 px-2.5 py-1.5 text-right text-[15px] tabular-nums outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>
          </li>
        </GroupedSection>

        {canManage ? (
          <div className="mt-4 flex items-center justify-end gap-4 px-4">
            {!valid ? <span className="text-[13px] text-destructive">Enter a whole number from 1 to 10,000.</span> : null}
            {changed ? (
              <button
                type="button"
                className="text-[15px] text-muted-foreground"
                onClick={() => setDraft(String(pricing.unitPriceKes))}
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
              {saving ? "Saving…" : "Save price"}
            </button>
          </div>
        ) : null}
      </form>

      <GroupedSection header={changed ? "What players will pay" : "What players pay"}>
        {EXAMPLES.filter((count) => count >= pricing.minClips && count <= pricing.maxClips).map((count) => (
          <ValueRow key={count} label={`${count} clip${count === 1 ? "" : "s"}`} value={kes(preview * count)} />
        ))}
      </GroupedSection>
    </div>
  )
}
