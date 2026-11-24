"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
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

const VENUE_TIMEZONES = [
  { value: "Africa/Nairobi", label: "Nairobi (EAT, UTC+3)" },
  { value: "Africa/Kampala", label: "Kampala (EAT, UTC+3)" },
  { value: "Africa/Dar_es_Salaam", label: "Dar es Salaam (EAT, UTC+3)" },
  { value: "Africa/Addis_Ababa", label: "Addis Ababa (EAT, UTC+3)" },
  { value: "Africa/Kigali", label: "Kigali (CAT, UTC+2)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST, UTC+2)" },
  { value: "Africa/Cairo", label: "Cairo (UTC+2/+3)" },
  { value: "Africa/Lagos", label: "Lagos (WAT, UTC+1)" },
  { value: "Europe/London", label: "London (UTC+0/+1)" },
  { value: "UTC", label: "UTC" },
]

export function AdminCreateVenueDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (venue: { id: string; name: string }) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [timezone, setTimezone] = useState("Africa/Nairobi")
  const [notes, setNotes] = useState("")

  function reset() {
    setName("")
    setAddress("")
    setTimezone("Africa/Nairobi")
    setNotes("")
    setMessage(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    setSubmitting(true)
    try {
      const response = await fetch("/api/admin/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          timezone,
          notes: notes.trim() || null,
        }),
      })
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { message?: string }
        setMessage(error.message ?? "Could not create venue.")
        return
      }
      const payload = (await response.json()) as { data: { id: string; name: string } }
      onCreated(payload.data)
      reset()
      onOpenChange(false)
    } catch {
      setMessage("Could not reach the server. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return
        if (!next) setMessage(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add venue</DialogTitle>
          <DialogDescription>
            Create a new PlayTT location. You can add tables and devices right after.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-venue-name">Venue name</Label>
            <Input
              id="new-venue-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="PlayTT Westlands"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-venue-address">Address</Label>
            <Input
              id="new-venue-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Westlands, Nairobi, Kenya"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-venue-timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="new-venue-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENUE_TIMEZONES.map((zone) => (
                  <SelectItem key={zone.value} value={zone.value}>
                    {zone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for booking times and opening hours.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-venue-notes">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="new-venue-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Parking, access instructions, contact person…"
              rows={3}
            />
          </div>
          {message ? (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !name.trim() || !address.trim()}
            >
              {submitting ? "Creating…" : "Create venue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const [zoneId, setZoneId] = useState<string | undefined>(undefined)

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
