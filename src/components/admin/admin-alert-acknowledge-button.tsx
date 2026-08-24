"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"

export function AlertAcknowledgeButton({
  alertId,
  acknowledged,
}: {
  alertId: string
  acknowledged: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (acknowledged) {
    return (
      <Button size="sm" variant="secondary" disabled>
        Acknowledged
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await fetch("/api/admin/alerts/acknowledge", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ alertId }),
          })
          router.refresh()
        })
      }}
    >
      Acknowledge
    </Button>
  )
}
