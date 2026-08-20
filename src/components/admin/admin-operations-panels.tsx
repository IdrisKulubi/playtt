"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { useAdminSearchFilter } from "@/components/admin/admin-context"
import { AdminDashboardCard } from "@/components/admin/admin-dashboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import type { AdminIntegrationVendor, AdminVenueIntegration } from "@/server/admin/vendors-service"
import type { OperatorVenue } from "@/server/operator/types"

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

  const filteredVendors = useAdminSearchFilter(vendors, (vendor) =>
    [vendor.name, vendor.kind, vendor.status].join(" "),
  )
  const filteredIntegrations = useAdminSearchFilter(integrations, (row) =>
    [row.locationName, row.vendorName, row.vendorKind, row.status].join(" "),
  )

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
          <AdminDashboardCard title="Add integration vendor">
            <div className="space-y-3 p-5">
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
            </div>
          </AdminDashboardCard>

          <AdminDashboardCard title="Attach vendor to venue">
            <div className="space-y-3 p-5">
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
            </div>
          </AdminDashboardCard>
        </div>
      ) : null}

      <AdminDashboardCard title={`Vendors (${filteredVendors.length})`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVendors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {vendors.length === 0 ? "No vendors yet." : "No vendors match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filteredVendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">{vendor.name}</TableCell>
                  <TableCell>{vendor.kind}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{vendor.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminDashboardCard>

      <AdminDashboardCard title={`Venue integrations (${filteredIntegrations.length})`}>
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
            {filteredIntegrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {integrations.length === 0
                    ? "No venue integrations yet."
                    : "No integrations match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filteredIntegrations.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.locationName}</TableCell>
                  <TableCell>{row.vendorName}</TableCell>
                  <TableCell>{row.vendorKind}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminDashboardCard>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  )
}
