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
import type { DeviceListItem } from "@/server/devices/devices"
import type { OperatorResource, OperatorVenue } from "@/server/operator/types"

type OperatorDevicesPanelProps = {
  venues: OperatorVenue[]
  resources: OperatorResource[]
  devices: DeviceListItem[]
  selectedVenueId: string
  canManage: boolean
}

export function OperatorDevicesPanel({
  venues,
  resources,
  devices,
  selectedVenueId,
  canManage,
}: OperatorDevicesPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deviceType, setDeviceType] = useState<
    "esp32_controller" | "ttlock_lock" | "ttlock_gateway"
  >("esp32_controller")
  const [enrollmentCode, setEnrollmentCode] = useState<string | null>(null)
  const [assignDeviceId, setAssignDeviceId] = useState("")
  const [assignResourceId, setAssignResourceId] = useState("")
  const [assignRole, setAssignRole] = useState<
    "score_input" | "lock" | "gateway" | "display"
  >("score_input")
  const [message, setMessage] = useState<string | null>(null)

  const venueResources = resources.filter(
    (resource) => resource.locationId === selectedVenueId,
  )

  async function handleCreateEnrollment() {
    setMessage(null)
    setEnrollmentCode(null)

    const response = await fetch("/api/operator/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: selectedVenueId,
        deviceType,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not create enrollment.")
      return
    }

    const payload = await response.json()
    setEnrollmentCode(payload.data.enrollment.enrollmentCode)
    startTransition(() => router.refresh())
  }

  async function handleAssignDevice() {
    setMessage(null)

    const response = await fetch("/api/operator/devices/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: assignDeviceId,
        locationId: selectedVenueId,
        resourceId: assignResourceId || null,
        role: assignRole,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not assign device.")
      return
    }

    startTransition(() => router.refresh())
  }

  async function handleRevokeDevice(deviceId: string) {
    setMessage(null)

    const response = await fetch("/api/operator/devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", deviceId }),
    })

    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not revoke device.")
      return
    }

    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Issue enrollment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="device-type">Device type</Label>
                <Select
                  value={deviceType}
                  onValueChange={(value) =>
                    setDeviceType(value as typeof deviceType)
                  }
                >
                  <SelectTrigger id="device-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="esp32_controller">
                      ESP32 controller
                    </SelectItem>
                    <SelectItem value="ttlock_lock">TTLock lock</SelectItem>
                    <SelectItem value="ttlock_gateway">
                      TTLock gateway
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button disabled={isPending} onClick={handleCreateEnrollment}>
              Create enrollment code
            </Button>
            {enrollmentCode ? (
              <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm">
                Enrollment code (shown once):{" "}
                <span className="font-mono font-semibold">{enrollmentCode}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Assign device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assign-device-id">Device</Label>
                <Select value={assignDeviceId} onValueChange={setAssignDeviceId}>
                  <SelectTrigger id="assign-device-id">
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.hardwareUid} ({device.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-resource-id">Resource</Label>
                <Select
                  value={assignResourceId}
                  onValueChange={setAssignResourceId}
                >
                  <SelectTrigger id="assign-resource-id">
                    <SelectValue placeholder="Optional for gateways" />
                  </SelectTrigger>
                  <SelectContent>
                    {venueResources.map((resource) => (
                      <SelectItem key={resource.id} value={resource.id}>
                        {resource.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-role">Role</Label>
                <Select
                  value={assignRole}
                  onValueChange={(value) =>
                    setAssignRole(value as typeof assignRole)
                  }
                >
                  <SelectTrigger id="assign-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score_input">Score input</SelectItem>
                    <SelectItem value="lock">Lock</SelectItem>
                    <SelectItem value="gateway">Gateway</SelectItem>
                    <SelectItem value="display">Display</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button disabled={isPending || !assignDeviceId} onClick={handleAssignDevice}>
              Assign device
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Registered devices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No devices provisioned for this venue yet.
            </p>
          ) : (
            devices.map((device) => (
              <div
                key={device.id}
                className="flex flex-col gap-2 rounded-2xl border border-white/8 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">{device.hardwareUid}</p>
                  <p className="text-sm text-muted-foreground">
                    {device.type} · {device.status}
                  </p>
                  {device.currentAssignment ? (
                    <p className="text-sm text-muted-foreground">
                      Assigned as {device.currentAssignment.role}
                      {device.currentAssignment.resourceId
                        ? ` on resource ${device.currentAssignment.resourceId}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No current assignment
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {device.status !== "revoked" ? (
                    <Badge variant="outline">{device.status}</Badge>
                  ) : (
                    <Badge variant="destructive">revoked</Badge>
                  )}
                  {canManage && device.status !== "revoked" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleRevokeDevice(device.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {message ? (
        <p className="text-sm text-destructive" role="alert">{message}</p>
      ) : null}
    </div>
  )
}
