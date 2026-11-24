"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

/** A quiet text action, iOS style. Flips immediately on press, reverts if saving fails. */
export function AlertAcknowledgeButton({
  alertId,
  acknowledged,
}: {
  alertId: string
  acknowledged: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(acknowledged)

  if (done) {
    return <span className="text-muted-foreground">Acknowledged</span>
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setDone(true)
        startTransition(async () => {
          const response = await fetch("/api/admin/alerts/acknowledge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ alertId }),
          }).catch(() => null)
          if (!response?.ok) {
            setDone(false)
            toast.error("Couldn't acknowledge the alert. Try again.")
            return
          }
          router.refresh()
        })
      }}
      className="font-medium text-primary transition-opacity active:opacity-50 disabled:opacity-50"
    >
      Acknowledge
    </button>
  )
}
