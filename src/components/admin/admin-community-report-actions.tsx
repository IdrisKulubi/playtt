"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

type Action = "review" | "mute" | "hide"

const CONFIRM: Partial<Record<Action, string>> = {
  mute: "Mute this player for 7 days? They can't chat, follow or go open to play until then.",
  hide: "Hide this player's card? They disappear from Community until they turn it back on.",
}

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message ?? "Request failed.")
  }
}

export function CommunityReportActions({ reportId, open }: { reportId: string; open: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: Action) {
    const confirmCopy = CONFIRM[action]
    if (confirmCopy && !window.confirm(confirmCopy)) return
    setError(null)
    startTransition(async () => {
      try {
        await post(`/api/admin/community/reports/${reportId}`, { action })
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Request failed.")
      }
    })
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <Button size="sm" variant="outline" disabled={pending || !open} onClick={() => run("review")}>
        {open ? "Mark reviewed" : "Reviewed"}
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("mute")}>
        Mute 7 days
      </Button>
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => run("hide")}>
        Hide card
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function ExcuseBookingButton({ bookingId, userId }: { bookingId: string; userId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending || done}
      onClick={() => {
        const reason = window.prompt("Why is this miss excused? (e.g. venue power cut)")
        if (!reason || reason.trim().length < 3) return
        startTransition(async () => {
          await post("/api/admin/community/reliability-overrides", { bookingId, userId, reason: reason.trim() })
          setDone(true)
          router.refresh()
        })
      }}
    >
      {done ? "Excused" : "Excuse miss"}
    </Button>
  )
}
