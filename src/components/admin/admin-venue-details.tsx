"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function AdminVenueDetails({
  venue,
  zones,
  tableCountByZone,
  canManage,
}: {
  venue: { id: string; slug: string; timezone: string; address: string | null; isActive: boolean }
  zones: { id: string; name: string }[]
  tableCountByZone: Record<string, number>
  canManage: boolean
}) {
  const router = useRouter()
  const [zoneName, setZoneName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function addZone(event: React.FormEvent) {
    event.preventDefault()
    const name = zoneName.trim()
    if (!name) return
    setError(null)
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/venues/${venue.id}/zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.message ?? payload?.error?.message ?? "Couldn't add the area. Try again.")
        return
      }
      setZoneName("")
      startTransition(() => router.refresh())
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold">Venue</h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{venue.isActive ? "Open for bookings" : "Inactive"}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd>{venue.address || "—"}</dd>
            <dt className="text-muted-foreground">Time zone</dt>
            <dd>{venue.timezone}</dd>
            <dt className="text-muted-foreground">Web address</dt>
            <dd className="font-mono text-xs leading-5">{venue.slug}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Areas</h2>
            <p className="text-sm text-muted-foreground">
              Optional groups for tables, such as a main hall or a private room.
            </p>
          </div>
          {zones.length > 0 ? (
            <ul className="divide-y rounded-2xl border text-sm">
              {zones.map((zone) => {
                const count = tableCountByZone[zone.id] ?? 0
                return (
                  <li key={zone.id} className="flex items-center justify-between px-4 py-2.5">
                    <span>{zone.name}</span>
                    <span className="text-muted-foreground">
                      {count} {count === 1 ? "table" : "tables"}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : null}
          {canManage ? (
            <form onSubmit={addZone} className="flex gap-2">
              <Input
                value={zoneName}
                onChange={(event) => setZoneName(event.target.value)}
                placeholder="New area name"
                aria-label="New area name"
              />
              <Button type="submit" size="sm" variant="outline" disabled={isSaving || isPending || !zoneName.trim()}>
                Add area
              </Button>
            </form>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
