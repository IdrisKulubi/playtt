"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminBookingRow } from "@/server/admin/analytics-service"
import type { AdminIntegrationVendor, AdminVenueIntegration } from "@/server/admin/vendors-service"
import type { OperatorVenue } from "@/server/operator/types"

export function AdminBookingsTable({
  bookings,
  venues,
}: {
  bookings: AdminBookingRow[]
  venues: OperatorVenue[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform bookings ({bookings.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {new Date(booking.startTime).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div>
                    <p>{booking.userName}</p>
                    <p className="text-xs text-muted-foreground">{booking.userEmail}</p>
                  </div>
                </TableCell>
                <TableCell>{booking.locationName}</TableCell>
                <TableCell>{booking.resourceName}</TableCell>
                <TableCell>
                  <Badge variant="outline">{booking.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{booking.paymentStatus}</Badge>
                </TableCell>
                <TableCell>
                  {booking.currency} {booking.totalAmount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function AdminRevenuePanel({
  byVenue,
  byDay,
}: {
  byVenue: { locationName: string; totalAmount: string; paymentCount: number }[]
  byDay: { day: string; totalAmount: string; paymentCount: number }[]
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Revenue by venue (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byVenue.map((row) => (
                <TableRow key={row.locationName}>
                  <TableCell>{row.locationName}</TableCell>
                  <TableCell>{row.paymentCount}</TableCell>
                  <TableCell>KES {Number(row.totalAmount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by day (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDay.map((row) => (
                <TableRow key={row.day}>
                  <TableCell>{row.day}</TableCell>
                  <TableCell>{row.paymentCount}</TableCell>
                  <TableCell>KES {Number(row.totalAmount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function AdminVendorsPanel({
  vendors,
  integrations,
  venues,
  canManage,
}: {
  vendors: AdminIntegrationVendor[]
  integrations: AdminVenueIntegration[]
  venues: OperatorVenue[]
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState("")
  const [vendorKind, setVendorKind] = useState<
    "ttlock" | "camera" | "esp32" | "paystack" | "other"
  >("ttlock")
  const [attachVenueId, setAttachVenueId] = useState<string | undefined>()
  const [attachVendorId, setAttachVendorId] = useState<string | undefined>()

  async function handleCreateVendor() {
    setMessage(null)
    const response = await fetch("/api/admin/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: vendorName, kind: vendorKind }),
    })
    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not create vendor.")
      return
    }
    setVendorName("")
    startTransition(() => router.refresh())
  }

  async function handleAttachIntegration() {
    if (!attachVenueId || !attachVendorId) return
    setMessage(null)
    const response = await fetch("/api/admin/vendors/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: attachVenueId,
        vendorId: attachVendorId,
        status: "pending",
      }),
    })
    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not attach integration.")
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add integration vendor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="vendor-name">Name</Label>
                <Input
                  id="vendor-name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                />
              </div>
              <Select
                value={vendorKind}
                onValueChange={(value) => setVendorKind(value as typeof vendorKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ttlock">TTLock</SelectItem>
                  <SelectItem value="camera">Camera / NVR</SelectItem>
                  <SelectItem value="esp32">ESP32</SelectItem>
                  <SelectItem value="paystack">Paystack</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreateVendor} disabled={isPending || !vendorName.trim()}>
                Create vendor
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attach vendor to venue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={attachVenueId} onValueChange={setAttachVenueId}>
                <SelectTrigger>
                  <SelectValue placeholder="Venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={attachVendorId} onValueChange={setAttachVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAttachIntegration}
                disabled={isPending || !attachVenueId || !attachVendorId}
              >
                Attach integration
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Vendors ({vendors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell>{vendor.name}</TableCell>
                  <TableCell>{vendor.kind}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{vendor.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Venue integrations ({integrations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.locationName}</TableCell>
                  <TableCell>{row.vendorName}</TableCell>
                  <TableCell>{row.vendorKind}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  )
}
