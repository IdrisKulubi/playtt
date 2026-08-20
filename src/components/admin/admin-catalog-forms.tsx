"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OperatorVenue } from "@/server/operator/types"

export function AdminCreateVenueForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [timezone, setTimezone] = useState("Africa/Nairobi")

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)

    const response = await fetch("/api/admin/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, timezone }),
    })

    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not create venue.")
      return
    }

    const payload = await response.json()
    startTransition(() => router.push(`/admin/venues/${payload.data.id}`))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add venue</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="venue-name">Name</Label>
            <Input
              id="venue-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue-address">Address</Label>
            <Input
              id="venue-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue-timezone">Timezone</Label>
            <Input
              id="venue-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </div>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <Button type="submit" disabled={isPending}>
            Create venue
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function AdminVenueCatalogForms({
  venueId,
  zones,
  canManage,
}: {
  venueId: string
  zones: { id: string; name: string }[]
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  if (!canManage) return null

  async function createZone(formData: FormData) {
    setMessage(null)
    const response = await fetch(`/api/admin/venues/${venueId}/zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formData.get("zoneName") }),
    })
    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not create zone.")
      return
    }
    startTransition(() => router.refresh())
  }

  const [zoneId, setZoneId] = useState<string | undefined>(undefined)

  async function createResource(formData: FormData) {
    setMessage(null)
    const response = await fetch(`/api/admin/venues/${venueId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("resourceName"),
        code: formData.get("resourceCode") || null,
        zoneId: zoneId ?? null,
      }),
    })
    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not create table.")
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Add zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createZone} className="space-y-3">
            <Input name="zoneName" placeholder="Main Hall" required />
            <Button type="submit" disabled={isPending}>
              Add zone
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add table / resource</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createResource} className="space-y-3">
            <Input name="resourceName" placeholder="Table 02" required />
            <Input name="resourceCode" placeholder="Table 02" />
            {zones.length > 0 ? (
              <Select value={zoneId} onValueChange={setZoneId}>
                <SelectTrigger>
                  <SelectValue placeholder="Zone (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button type="submit" disabled={isPending}>
              Add resource
            </Button>
          </form>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-destructive lg:col-span-2">{message}</p> : null}
    </div>
  )
}

export function AdminVenueSelector({
  venues,
  selectedVenueId,
  basePath,
}: {
  venues: OperatorVenue[]
  selectedVenueId?: string
  basePath: string
}) {
  const router = useRouter()

  return (
    <Select
      value={selectedVenueId}
      onValueChange={(value) => router.push(`${basePath}?venueId=${value}`)}
    >
      <SelectTrigger className="max-w-sm">
        <SelectValue placeholder="Select venue" />
      </SelectTrigger>
      <SelectContent>
        {venues.map((venue) => (
          <SelectItem key={venue.id} value={venue.id}>
            {venue.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
