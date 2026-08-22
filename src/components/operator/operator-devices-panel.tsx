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

type OperatorDeviceType =
  | "esp32_controller"
  | "ttlock_lock"
  | "ttlock_gateway"
  | "venue_edge"
  | "camera"

type OperatorAssignmentRole =
  | "score_input"
  | "lock"
  | "gateway"
  | "display"
  | "venue_edge"
  | "replay_primary"

type IssuedCredentials = {
  deviceId: string
  secret: string
  credentialVersion: number
  hardwareUid: string
  deviceType: OperatorDeviceType
}

const RESOURCE_REQUIRED_ROLES = new Set<OperatorAssignmentRole>([
  "score_input",
  "display",
  "venue_edge",
  "replay_primary",
])

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
  const [deviceType, setDeviceType] =
    useState<OperatorDeviceType>("venue_edge")
  const [enrollmentCode, setEnrollmentCode] = useState<string | null>(null)
  const [issuedCredentials, setIssuedCredentials] =
    useState<IssuedCredentials | null>(null)
  const [assignDeviceId, setAssignDeviceId] = useState<string | undefined>(
    undefined,
  )
  const [assignResourceId, setAssignResourceId] = useState<string | undefined>(
    undefined,
  )
  const [assignRole, setAssignRole] =
    useState<OperatorAssignmentRole>("venue_edge")
  const [rtspUrl, setRtspUrl] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const venueResources = resources.filter(
    (resource) => resource.locationId === selectedVenueId,
  )
  const resourceRequired = RESOURCE_REQUIRED_ROLES.has(assignRole)

  async function handleCreateEnrollment() {
    setMessage(null)
    setEnrollmentCode(null)
    setIssuedCredentials(null)

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

    const payload = (await response.json()) as {
      data?: {
        enrollment?: { enrollmentCode?: string }
        credentials?: IssuedCredentials
      }
    }

    if (payload.data?.credentials) {
      setIssuedCredentials(payload.data.credentials)
      setAssignDeviceId(payload.data.credentials.deviceId)
      if (deviceType === "venue_edge") {
        setAssignRole("venue_edge")
      }
    } else if (payload.data?.enrollment?.enrollmentCode) {
      setEnrollmentCode(payload.data.enrollment.enrollmentCode)
    }

    startTransition(() => router.refresh())
  }

  async function handleAssignDevice() {
    setMessage(null)

    if (!assignDeviceId) {
      setMessage("Select a device first.")
      return
    }

    if (resourceRequired && !assignResourceId) {
      setMessage("This role must be assigned to a table resource.")
      return
    }

    const config =
      assignRole === "venue_edge" && rtspUrl.trim()
        ? {
            camera: {
              rtspUrl: rtspUrl.trim(),
            },
          }
        : undefined

    const response = await fetch("/api/operator/devices/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: assignDeviceId,
        locationId: selectedVenueId,
        resourceId: assignResourceId ?? null,
        role: assignRole,
        config,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not assign device.")
      return
    }

    setAssignDeviceId(undefined)
    setAssignResourceId(undefined)
    setRtspUrl("")
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
            <p className="text-sm text-muted-foreground">
              VenueEdge credentials are issued immediately. Copy the secret now —
              it is not shown again. Then assign the device to a table.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="device-type">Device type</Label>
                <Select
                  value={deviceType}
                  onValueChange={(value) =>
                    setDeviceType(value as OperatorDeviceType)
                  }
                >
                  <SelectTrigger id="device-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venue_edge">VenueEdge (replay)</SelectItem>
                    <SelectItem value="camera">Camera</SelectItem>
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
            <Button disabled={isPending} onClick={() => void handleCreateEnrollment()}>
              {deviceType === "venue_edge" || deviceType === "camera"
                ? "Issue device credentials"
                : "Create enrollment code"}
            </Button>
            {enrollmentCode ? (
              <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm">
                Enrollment code (shown once):{" "}
                <span className="font-mono font-semibold">{enrollmentCode}</span>
              </p>
            ) : null}
            {issuedCredentials ? (
              <div className="space-y-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm">
                <p className="font-medium">Device credentials (shown once)</p>
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify(
                    {
                      deviceId: issuedCredentials.deviceId,
                      secret: issuedCredentials.secret,
                      credentialVersion: issuedCredentials.credentialVersion,
                    },
                    null,
                    2,
                  )}
                </pre>
                <p className="text-muted-foreground">
                  Save as{" "}
                  <code>services/venue-edge/.venue-edge-data/credentials.json</code>{" "}
                  on the venue PC.
                </p>
              </div>
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
            <p className="text-sm text-muted-foreground">
              For replay capture, pick the VenueEdge device, choose a table, and
              assign role <span className="font-medium">Venue edge</span>.
            </p>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => startTransition(() => router.refresh())}
            >
              Refresh device list
            </Button>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assign-device-id">Device</Label>
                <Select
                  value={assignDeviceId}
                  onValueChange={setAssignDeviceId}
                >
                  <SelectTrigger id="assign-device-id">
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No devices at this venue yet
                      </SelectItem>
                    ) : (
                      devices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.hardwareUid} ({device.type})
                        </SelectItem>
                      ))
                    )}
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
                    <SelectValue placeholder="Select table resource" />
                  </SelectTrigger>
                  <SelectContent>
                    {venueResources.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No resources at this venue
                      </SelectItem>
                    ) : (
                      venueResources.map((resource) => (
                        <SelectItem key={resource.id} value={resource.id}>
                          {resource.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-role">Role</Label>
                <Select
                  value={assignRole}
                  onValueChange={(value) =>
                    setAssignRole(value as OperatorAssignmentRole)
                  }
                >
                  <SelectTrigger id="assign-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venue_edge">Venue edge</SelectItem>
                    <SelectItem value="replay_primary">Replay camera</SelectItem>
                    <SelectItem value="score_input">Score input</SelectItem>
                    <SelectItem value="lock">Lock</SelectItem>
                    <SelectItem value="gateway">Gateway</SelectItem>
                    <SelectItem value="display">Display</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assignRole === "venue_edge" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="rtsp-url">RTSP URL (optional)</Label>
                  <Input
                    id="rtsp-url"
                    value={rtspUrl}
                    onChange={(event) => setRtspUrl(event.target.value)}
                    placeholder="rtsp://user:pass@192.168.0.240:554/..."
                    autoComplete="off"
                  />
                </div>
              ) : null}
            </div>
            <Button
              disabled={
                isPending ||
                !assignDeviceId ||
                (resourceRequired && !assignResourceId)
              }
              onClick={() => void handleAssignDevice()}
            >
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
                  <p className="text-sm text-muted-foreground">
                    Health:{" "}
                    <span
                      className={
                        device.health === "online"
                          ? "text-emerald-400"
                          : device.health === "offline"
                            ? "text-rose-400"
                            : "text-muted-foreground"
                      }
                    >
                      {device.health}
                    </span>
                    {device.lastHeartbeatAt
                      ? ` · last heartbeat ${new Date(device.lastHeartbeatAt).toLocaleString()}`
                      : ""}
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
                  <Badge
                    variant={
                      device.health === "online"
                        ? "default"
                        : device.health === "offline"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {device.health}
                  </Badge>
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
                      onClick={() => void handleRevokeDevice(device.id)}
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
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  )
}
