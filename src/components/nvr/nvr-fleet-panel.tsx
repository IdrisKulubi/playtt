"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { VenueEdgeInstallationFleetView } from "@/server/replays/venue-edge-fleet"

function connectivityVariant(
  connectivity: VenueEdgeInstallationFleetView["connectivity"],
) {
  if (connectivity === "online") return "default"
  if (connectivity === "offline") return "destructive"
  if (connectivity === "pending_setup") return "secondary"
  return "outline"
}

export function NvrFleetPanel({
  selectedVenueId,
  initialInstallations,
}: {
  selectedVenueId: string
  initialInstallations: VenueEdgeInstallationFleetView[]
}) {
  const [installations, setInstallations] =
    useState<VenueEdgeInstallationFleetView[]>(initialInstallations)
  const [healthFilter, setHealthFilter] = useState<string>("all")
  const [commissioningFilter, setCommissioningFilter] = useState<string>("all")
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    return installations.filter((installation) => {
      if (healthFilter !== "all" && installation.connectivity !== healthFilter) {
        return false
      }

      if (
        commissioningFilter !== "all" &&
        installation.commissioningState !== commissioningFilter
      ) {
        return false
      }

      return true
    })
  }, [installations, healthFilter, commissioningFilter])

  async function refreshFleet() {
    setLoading(true)
    setMessage(null)

    try {
      const params = new URLSearchParams({ locationId: selectedVenueId })
      if (healthFilter !== "all") {
        params.set("health", healthFilter)
      }
      if (commissioningFilter !== "all") {
        params.set("commissioning", commissioningFilter)
      }

      const response = await fetch(
        `/api/operator/venue-edge/installations?${params.toString()}`,
      )
      if (!response.ok) {
        setMessage("Could not refresh VenueEdge fleet.")
        return
      }

      const payload = (await response.json()) as {
        data?: { installations?: VenueEdgeInstallationFleetView[] }
      }
      setInstallations(payload.data?.installations ?? [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>VenueEdge fleet</CardTitle>
          <p className="text-sm text-muted-foreground">
            Installations, health, commissioning, and config status for this
            venue.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refreshFleet()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={healthFilter} onValueChange={setHealthFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Health" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All connectivity</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="pending_setup">Pending setup</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={commissioningFilter}
            onValueChange={setCommissioningFilter}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Commissioning" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All commissioning</SelectItem>
              <SelectItem value="commissioned">Commissioned</SelectItem>
              <SelectItem value="not_commissioned">Not commissioned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {message ? <p className="text-sm text-destructive">{message}</p> : null}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No VenueEdge installations match these filters. Pair a new agent
            above to get started.
          </p>
        ) : (
          <div className="admin-table-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">Installation</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Version</th>
                  <th className="p-3">Topology</th>
                  <th className="p-3">Health</th>
                  <th className="p-3">Config</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((installation) => (
                  <tr key={installation.id} className="border-b align-top">
                    <td className="p-3">
                      <div className="font-medium">{installation.displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        {installation.platform} / {installation.architecture}
                      </div>
                      {installation.hostSleepRisk ? (
                        <p className="mt-1 text-xs text-amber-700">
                          {installation.hostSleepRiskReason ??
                            "Host sleep risk detected."}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <Badge variant={connectivityVariant(installation.connectivity)}>
                        {installation.connectivity}
                      </Badge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {installation.commissioningState === "commissioned"
                          ? "Commissioned"
                          : "Not commissioned"}
                      </div>
                    </td>
                    <td className="p-3">
                      <div>{installation.currentAgentVersion}</div>
                      <div className="text-xs text-muted-foreground">
                        channel {installation.updateChannel}
                      </div>
                    </td>
                    <td className="p-3">
                      <div>
                        {installation.topology.nvrCount} NVRs ·{" "}
                        {installation.topology.enabledCameraCount}/
                        {installation.topology.cameraCount} cameras
                      </div>
                      <div className="text-xs text-muted-foreground">
                        healthy {installation.sourceHealth.healthy} · degraded{" "}
                        {installation.sourceHealth.degraded} · unhealthy{" "}
                        {installation.sourceHealth.unhealthy}
                      </div>
                    </td>
                    <td className="p-3">
                      <div>
                        v{installation.publishedConfigVersion ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {installation.configApplicationStatus ?? "no ack"}
                      </div>
                      {installation.reauthRequiredCount > 0 ? (
                        <p className="mt-1 text-xs text-amber-700">
                          {installation.reauthRequiredCount} NVR credential(s)
                          need local re-entry
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/nvr/${installation.id}`}>Manage</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
