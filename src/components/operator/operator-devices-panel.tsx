"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  GroupedList,
  LargeTitle,
  SectionHeader,
  SegmentedControl,
  textActionClass,
} from "@/components/admin/admin-grouped"
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

type DeviceFilter = "active" | "unassigned" | "revoked"

const RESOURCE_REQUIRED_ROLES = new Set<OperatorAssignmentRole>([
  "score_input",
  "display",
  "venue_edge",
  "replay_primary",
])

const DEVICE_TYPE_LABELS: Record<string, string> = {
  esp32_controller: "ESP32 score buttons",
  venue_edge: "VenueEdge (replay PC)",
  camera: "Camera",
  ttlock_lock: "TTLock lock",
  ttlock_gateway: "TTLock gateway",
}

const ROLE_LABELS: Record<OperatorAssignmentRole, string> = {
  score_input: "Score input",
  venue_edge: "Venue edge",
  replay_primary: "Replay camera",
  lock: "Lock",
  gateway: "Gateway",
  display: "Display",
}

// The role an operator almost always wants for each device type.
const DEFAULT_ROLE_BY_TYPE: Record<string, OperatorAssignmentRole> = {
  esp32_controller: "score_input",
  venue_edge: "venue_edge",
  camera: "replay_primary",
  ttlock_lock: "lock",
  ttlock_gateway: "gateway",
}

type OperatorDevicesPanelProps = {
  venues: OperatorVenue[]
  resources: OperatorResource[]
  devices: DeviceListItem[]
  selectedVenueId: string
  canManage: boolean
}

function deviceTypeLabel(type: string) {
  return DEVICE_TYPE_LABELS[type] ?? type
}

function formatRelative(iso: string | null) {
  if (!iso) return "never"
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return new Date(iso).toLocaleDateString()
}

function healthRank(device: DeviceListItem) {
  if (device.health === "online") return 0
  if (device.health === "unknown") return 1
  return 2
}

async function readError(response: Response, fallback: string) {
  try {
    const error = (await response.json()) as { message?: string }
    return error.message ?? fallback
  } catch {
    return fallback
  }
}

export function OperatorDevicesPanel({
  resources,
  devices,
  selectedVenueId,
  canManage,
}: OperatorDevicesPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<DeviceFilter>("active")
  const [query, setQuery] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [deviceType, setDeviceType] =
    useState<OperatorDeviceType>("esp32_controller")
  const [enrollmentCode, setEnrollmentCode] = useState<string | null>(null)
  const [issuedCredentials, setIssuedCredentials] =
    useState<IssuedCredentials | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignResourceId, setAssignResourceId] = useState<string | undefined>()
  const [assignRole, setAssignRole] =
    useState<OperatorAssignmentRole>("score_input")
  const [rtspUrl, setRtspUrl] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const venueResources = useMemo(
    () => resources.filter((resource) => resource.locationId === selectedVenueId),
    [resources, selectedVenueId],
  )
  const resourceNameById = useMemo(
    () => new Map(venueResources.map((resource) => [resource.id, resource.name])),
    [venueResources],
  )

  const activeDevices = devices.filter((device) => device.status !== "revoked")
  const revokedDevices = devices.filter((device) => device.status === "revoked")
  const unassignedDevices = activeDevices.filter(
    (device) => !device.currentAssignment,
  )
  const onlineCount = activeDevices.filter(
    (device) => device.health === "online",
  ).length

  const visibleDevices = (() => {
    const base =
      filter === "revoked"
        ? revokedDevices
        : filter === "unassigned"
          ? unassignedDevices
          : activeDevices
    const needle = query.trim().toLowerCase()
    const matched = needle
      ? base.filter((device) =>
          [
            device.hardwareUid,
            device.id,
            deviceTypeLabel(device.type),
            device.currentAssignment?.resourceId
              ? resourceNameById.get(device.currentAssignment.resourceId)
              : "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : base
    return [...matched].sort((a, b) => {
      // Unassigned first (they need attention), then online, then most recent.
      const assignedDiff =
        Number(Boolean(a.currentAssignment)) - Number(Boolean(b.currentAssignment))
      if (filter !== "revoked" && assignedDiff !== 0) return assignedDiff
      const healthDiff = healthRank(a) - healthRank(b)
      if (healthDiff !== 0) return healthDiff
      return (b.lastHeartbeatAt ?? b.createdAt).localeCompare(
        a.lastHeartbeatAt ?? a.createdAt,
      )
    })
  })()

  const refresh = () => startTransition(() => router.refresh())

  async function handleCreateEnrollment() {
    setMessage(null)
    setNotice(null)
    setEnrollmentCode(null)
    setIssuedCredentials(null)

    const response = await fetch("/api/operator/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: selectedVenueId, deviceType }),
    })

    if (!response.ok) {
      setMessage(await readError(response, "Could not create enrollment."))
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
    } else if (payload.data?.enrollment?.enrollmentCode) {
      setEnrollmentCode(payload.data.enrollment.enrollmentCode)
    }

    refresh()
  }

  function startAssign(device: DeviceListItem) {
    setMessage(null)
    setNotice(null)
    setAssigningId(device.id)
    setAssignRole(
      (device.currentAssignment?.role as OperatorAssignmentRole | undefined) ??
        DEFAULT_ROLE_BY_TYPE[device.type] ??
        "score_input",
    )
    setAssignResourceId(
      device.currentAssignment?.resourceId ??
        (venueResources.length === 1 ? venueResources[0].id : undefined),
    )
    setRtspUrl("")
  }

  async function handleAssignDevice(device: DeviceListItem) {
    setMessage(null)

    if (RESOURCE_REQUIRED_ROLES.has(assignRole) && !assignResourceId) {
      setMessage("Pick a table for this device.")
      return
    }

    const config =
      assignRole === "venue_edge" && rtspUrl.trim()
        ? { camera: { rtspUrl: rtspUrl.trim() } }
        : undefined

    const tableName = assignResourceId
      ? resourceNameById.get(assignResourceId)
      : null

    // A table can only have one score input. Offer to swap instead of failing.
    const scoringConflict =
      assignRole === "score_input" && assignResourceId
        ? activeDevices.find(
            (other) =>
              other.id !== device.id &&
              other.currentAssignment?.role === "score_input" &&
              other.currentAssignment.resourceId === assignResourceId,
          )
        : undefined
    if (scoringConflict) {
      if (
        !window.confirm(
          `${tableName ?? "That table"} already has score buttons (${scoringConflict.hardwareUid}). ` +
            "Unassign that device and use this one instead?",
        )
      ) {
        return
      }
      if (!(await endAssignment(scoringConflict.currentAssignment!.id))) return
    }

    // Moving a device: close its current assignment before opening the new one.
    if (device.currentAssignment) {
      if (!(await endAssignment(device.currentAssignment.id))) return
    }

    const response = await fetch("/api/operator/devices/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: device.id,
        locationId: selectedVenueId,
        resourceId: assignResourceId ?? null,
        role: assignRole,
        config,
      }),
    })

    if (!response.ok) {
      setMessage(await readError(response, "Could not assign device."))
      refresh()
      return
    }

    setNotice(
      `${deviceTypeLabel(device.type)} assigned${tableName ? ` to ${tableName}` : ""} as ${ROLE_LABELS[assignRole]}.`,
    )
    setAssigningId(null)
    refresh()
  }

  async function endAssignment(assignmentId: string): Promise<boolean> {
    const response = await fetch("/api/operator/devices/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end", assignmentId }),
    })
    if (!response.ok) {
      setMessage(await readError(response, "Could not remove the current assignment."))
      return false
    }
    return true
  }

  async function handleUnassign(device: DeviceListItem) {
    if (!device.currentAssignment) return
    if (!window.confirm(`Remove ${deviceTypeLabel(device.type)} ${device.hardwareUid} from its table?`)) {
      return
    }
    setMessage(null)
    setNotice(null)
    if (await endAssignment(device.currentAssignment.id)) {
      setAssigningId(null)
      setNotice("Device unassigned.")
      refresh()
    }
  }

  async function patchDevice(
    action: "revoke" | "delete",
    deviceId: string,
  ): Promise<boolean> {
    const response = await fetch("/api/operator/devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, deviceId }),
    })
    if (!response.ok) {
      setMessage(
        await readError(
          response,
          action === "revoke" ? "Could not revoke device." : "Could not delete device.",
        ),
      )
      return false
    }
    return true
  }

  async function handleRevokeDevice(device: DeviceListItem) {
    if (
      !window.confirm(
        `Revoke ${deviceTypeLabel(device.type)} ${device.hardwareUid}?\n\n` +
          "It will be disconnected immediately and can't come back. To use this hardware " +
          "again you'll need a new enrollment code and to set it up from scratch.",
      )
    ) {
      return
    }
    setMessage(null)
    setNotice(null)
    if (await patchDevice("revoke", device.id)) refresh()
  }

  async function handleDeleteDevice(device: DeviceListItem) {
    if (
      !window.confirm(
        `Delete ${device.hardwareUid}? This removes the device from this venue permanently.`,
      )
    ) {
      return
    }
    setMessage(null)
    setNotice(null)
    if (await patchDevice("delete", device.id)) refresh()
  }

  async function handleDeleteAllRevoked() {
    if (
      !window.confirm(
        `Delete all ${revokedDevices.length} revoked devices? They are already disconnected; ` +
          "this removes them from the list permanently.",
      )
    ) {
      return
    }
    setMessage(null)
    setNotice(null)
    let deleted = 0
    for (const device of revokedDevices) {
      if (!(await patchDevice("delete", device.id))) break
      deleted += 1
    }
    if (deleted > 0) setNotice(`Deleted ${deleted} revoked device${deleted === 1 ? "" : "s"}.`)
    refresh()
  }

  const filterTabs: { id: DeviceFilter; label: string; count: number }[] = [
    { id: "active", label: "Active", count: activeDevices.length },
    { id: "unassigned", label: "Needs a table", count: unassignedDevices.length },
    { id: "revoked", label: "Revoked", count: revokedDevices.length },
  ]

  return (
    <div className="space-y-6">
      {/* Summary + primary action */}
      <LargeTitle
        title={`${onlineCount} of ${activeDevices.length} online`}
        subtitle={
          unassignedDevices.length > 0
            ? `${unassignedDevices.length} device${unassignedDevices.length === 1 ? "" : "s"} still need a table`
            : "Every active device has a table"
        }
        accessory={
          <div className="flex items-center gap-5">
            <button type="button" className={textActionClass} disabled={isPending} onClick={refresh}>
              Refresh
            </button>
            {canManage ? (
              <Link href="/admin/devices/setup" className={textActionClass}>
                Set up controller
              </Link>
            ) : null}
            {canManage ? (
              <Button size="sm" onClick={() => setShowAdd((value) => !value)}>
                {showAdd ? "Done" : "Add device"}
              </Button>
            ) : null}
          </div>
        }
      />

      {canManage && showAdd ? (
        <div className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-border/60">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="space-y-2 md:w-72">
              <Label htmlFor="device-type">What are you adding?</Label>
              <Select
                value={deviceType}
                onValueChange={(value) => setDeviceType(value as OperatorDeviceType)}
              >
                <SelectTrigger id="device-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DEVICE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={isPending} onClick={() => void handleCreateEnrollment()}>
              {deviceType === "venue_edge" || deviceType === "camera"
                ? "Issue device credentials"
                : "Get enrollment code"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {deviceType === "esp32_controller"
              ? "Type this code into the ESP32 setup over USB. Once it connects it appears below under Needs a table."
              : deviceType === "venue_edge" || deviceType === "camera"
                ? "Credentials are issued straight away. Copy the secret now; it is not shown again."
                : "Use the code during device setup. It works once."}
          </p>
          {enrollmentCode ? (
            <div className="rounded-xl bg-muted/60 px-4 py-3">
              <p className="text-[13px] text-muted-foreground">Enrollment code · shown once</p>
              <div className="mt-1 flex items-baseline gap-4">
                <span className="font-mono text-xl font-semibold tracking-wide">{enrollmentCode}</span>
                <button
                  type="button"
                  className={textActionClass}
                  onClick={() => void navigator.clipboard?.writeText(enrollmentCode)}
                >
                  Copy
                </button>
              </div>
            </div>
          ) : null}
          {issuedCredentials ? (
            <div className="space-y-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
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
                <code>services/venue-edge/.venue-edge-data/credentials.json</code> on
                the venue PC, then assign it to a table below.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between">
        <SegmentedControl<DeviceFilter>
          label="Device filters"
          value={filter}
          onChange={setFilter}
          options={filterTabs.map((tab) => ({ value: tab.id, label: tab.label, count: tab.count }))}
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by ID, type or table"
          className="md:w-72"
          aria-label="Search devices"
        />
      </div>

      {notice ? (
        <p className="px-4 text-[15px]" role="status">
          {notice}
        </p>
      ) : null}
      {message ? (
        <p className="px-4 text-[15px] text-destructive" role="alert">
          {message}
        </p>
      ) : null}

      {/* Device list */}
      <section>
        <SectionHeader
          accessory={
            filter === "revoked" && canManage && revokedDevices.length > 0 ? (
              <button
                type="button"
                className="text-[13px] font-medium text-destructive transition-opacity active:opacity-50"
                disabled={isPending}
                onClick={() => void handleDeleteAllRevoked()}
              >
                Delete all
              </button>
            ) : undefined
          }
        >
          {filter === "active" ? "Active devices" : filter === "unassigned" ? "Needs a table" : "Revoked"}
        </SectionHeader>
        {visibleDevices.length === 0 ? (
          <p className="px-4 py-10 text-center text-[15px] text-muted-foreground">
            {query
              ? "No devices match your search."
              : filter === "unassigned"
                ? "Every active device has a table."
                : filter === "revoked"
                  ? "No revoked devices."
                  : "No devices at this venue yet. Use Add device to enroll one."}
          </p>
        ) : (
          <GroupedList>
          {visibleDevices.map((device) => {
            const assignment = device.currentAssignment
            const tableName = assignment?.resourceId
              ? resourceNameById.get(assignment.resourceId) ?? "Unknown table"
              : null
            const isRevoked = device.status === "revoked"
            const isAssigning = assigningId === device.id
            const healthText =
              device.health === "online"
                ? `Online · seen ${formatRelative(device.lastHeartbeatAt)}`
                : device.health === "offline"
                  ? `Offline · last seen ${formatRelative(device.lastHeartbeatAt)}`
                  : "Not connected yet"

            return (
              <li key={device.id} className="px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-6">
                  <div className="min-w-0">
                    <p className={`text-[15px] font-medium ${isRevoked ? "text-muted-foreground" : ""}`}>
                      {deviceTypeLabel(device.type)}
                      {device.status === "pending" ? <span className="font-normal text-muted-foreground"> · pending</span> : null}
                    </p>
                    <p className="truncate font-mono text-[12px] text-muted-foreground">{device.hardwareUid}</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      <span title={device.lastHeartbeatAt ?? undefined}>{isRevoked ? "Revoked" : healthText}</span>
                      {" · "}
                      {assignment ? (
                        <span className="text-foreground">
                          {tableName ?? "Venue-wide"}, {ROLE_LABELS[assignment.role as OperatorAssignmentRole] ?? assignment.role}
                        </span>
                      ) : isRevoked ? (
                        "Not assigned"
                      ) : (
                        <span className="font-semibold text-foreground">Needs a table</span>
                      )}
                    </p>
                  </div>

                  {canManage && !isAssigning ? (
                    <div className="flex shrink-0 items-center gap-5 pt-0.5">
                      {!isRevoked ? (
                        <>
                          <button type="button" className={textActionClass} disabled={isPending} onClick={() => startAssign(device)}>
                            {assignment ? "Change table" : "Assign to table"}
                          </button>
                          <button
                            type="button"
                            className="text-[13px] font-medium text-destructive transition-opacity active:opacity-50 disabled:opacity-40"
                            disabled={isPending}
                            onClick={() => void handleRevokeDevice(device)}
                          >
                            Revoke
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="text-[13px] font-medium text-destructive transition-opacity active:opacity-50 disabled:opacity-40"
                          disabled={isPending}
                          onClick={() => void handleDeleteDevice(device)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>

                {isAssigning ? (
                  <div className="mt-3 flex flex-col gap-3 border-t border-border/60 pt-3 md:flex-row md:items-end">
                    <div className="space-y-1.5 md:w-56">
                      <Label htmlFor={`table-${device.id}`}>Table</Label>
                      <Select value={assignResourceId} onValueChange={setAssignResourceId}>
                        <SelectTrigger id={`table-${device.id}`}>
                          <SelectValue placeholder="Pick a table" />
                        </SelectTrigger>
                        <SelectContent>
                          {venueResources.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              No tables at this venue
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
                    <div className="space-y-1.5 md:w-44">
                      <Label htmlFor={`role-${device.id}`}>Role</Label>
                      <Select
                        value={assignRole}
                        onValueChange={(value) =>
                          setAssignRole(value as OperatorAssignmentRole)
                        }
                      >
                        <SelectTrigger id={`role-${device.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {assignRole === "venue_edge" ? (
                      <div className="flex-1 space-y-1.5">
                        <Label htmlFor={`rtsp-${device.id}`}>RTSP URL (optional)</Label>
                        <Input
                          id={`rtsp-${device.id}`}
                          value={rtspUrl}
                          onChange={(event) => setRtspUrl(event.target.value)}
                          placeholder="rtsp://user:pass@192.168.0.240:554/..."
                          autoComplete="off"
                        />
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={
                          isPending ||
                          (RESOURCE_REQUIRED_ROLES.has(assignRole) && !assignResourceId)
                        }
                        onClick={() => void handleAssignDevice(device)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAssigningId(null)}
                      >
                        Cancel
                      </Button>
                      {assignment ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={isPending}
                          onClick={() => void handleUnassign(device)}
                        >
                          Unassign
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
          </GroupedList>
        )}
      </section>
    </div>
  )
}
