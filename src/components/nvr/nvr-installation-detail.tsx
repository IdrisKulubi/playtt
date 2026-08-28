"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { NvrConfigStatus } from "@/components/nvr/nvr-config-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { VenueEdgeInstallationDetailView } from "@/server/replays/venue-edge-fleet"

function readApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback
  }

  const record = payload as {
    message?: unknown
    error?: { message?: unknown }
  }

  if (typeof record.message === "string" && record.message.trim().length > 0) {
    return record.message
  }

  if (
    typeof record.error?.message === "string" &&
    record.error.message.trim().length > 0
  ) {
    return record.error.message
  }

  return fallback
}

export function NvrInstallationDetail({
  installation,
  canManage,
}: {
  installation: VenueEdgeInstallationDetailView
  canManage: boolean
}) {
  const [displayName, setDisplayName] = useState(installation.displayName)
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [replacePairingCode, setReplacePairingCode] = useState<string | null>(null)

  const snapshot = installation.commissioningSnapshot
  const rollbackRevision =
    installation.lastAppliedConfigRevision ?? installation.publishedConfigRevision

  async function runAction(
    action:
      | "sync_commissioning"
      | "revoke"
      | "rotate_credential"
      | "rollback_config",
    extra?: Record<string, string>,
  ) {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch(
        `/api/operator/venue-edge/installations/${installation.id}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            reason,
            ...extra,
          }),
        },
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setMessage(
          readApiErrorMessage(
            payload,
            "VenueEdge action failed. Check permissions.",
          ),
        )
        return
      }

      setMessage("Action completed. Refresh this page to see updated status.")
      setReason("")
    })
  }

  async function handleReplacePc() {
    setMessage(null)
    setReplacePairingCode(null)

    startTransition(async () => {
      const response = await fetch("/api/operator/venue-edge/pairing-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: installation.locationId,
          replaceInstallationId: installation.id,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setMessage(
          readApiErrorMessage(
            payload,
            "Could not create replace-PC pairing session.",
          ),
        )
        return
      }

      const payload = (await response.json()) as {
        data?: { session?: { pairingCode?: string } }
      }

      if (!payload.data?.session?.pairingCode) {
        setMessage("Replace-PC session created without a displayable code.")
        return
      }

      setReplacePairingCode(payload.data.session.pairingCode)
      setMessage(
        "Replace-PC pairing code created. Enter it on the new venue PC during setup.",
      )
    })
  }

  async function clearResourceOverride(resourceId: string) {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch(
        `/api/operator/venue-edge/resources/${resourceId}/source-policy`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clearOverride: true,
            selectionMode: "automatic",
            locationId: installation.locationId,
            reason,
          }),
        },
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setMessage(
          readApiErrorMessage(
            payload,
            "Could not clear manual override for this resource.",
          ),
        )
        return
      }

      setMessage("Manual override cleared and config published.")
    })
  }

  async function saveDisplayName() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch(
        `/api/operator/venue-edge/installations/${installation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName, reason }),
        },
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setMessage(
          readApiErrorMessage(
            payload,
            "Could not rename this installation.",
          ),
        )
        return
      }

      setMessage("Installation renamed.")
      setReason("")
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/nvr?venueId=${installation.locationId}`}>
            Back to fleet
          </Link>
        </Button>
        <Badge>{installation.connectivity}</Badge>
        <Badge variant="outline">{installation.commissioningState}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{installation.displayName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Last heartbeat</dt>
              <dd>{installation.lastHeartbeatAt ?? "Never"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Agent version</dt>
              <dd>
                {installation.currentAgentVersion} ({installation.updateChannel})
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Replay queue</dt>
              <dd>{installation.replayQueueDepth}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Manual override</dt>
              <dd>{installation.hasManualOverride ? "Active" : "None"}</dd>
            </div>
          </dl>

          {installation.hostSleepRisk ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {installation.hostSleepRiskReason ??
                "This venue PC may sleep and interrupt capture."}
            </p>
          ) : null}

          <NvrConfigStatus installation={installation} />

          {canManage ? (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-medium">Guided actions</h3>
              <p className="text-sm text-muted-foreground">
                Open the local setup wizard on the venue PC to change NVR
                passwords or camera mappings. Cloud actions here publish desired
                config and manage device identity.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="display-name">Display name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action-reason">Reason (required)</Label>
                  <Input
                    id="action-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Why is this change needed?"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={isPending || reason.trim().length < 4}
                  onClick={() => void saveDisplayName()}
                >
                  Rename
                </Button>
                <Button
                  variant="outline"
                  disabled={isPending || reason.trim().length < 4}
                  onClick={() => void runAction("sync_commissioning")}
                >
                  Sync commissioning + publish
                </Button>
                {rollbackRevision ? (
                  <Button
                    variant="outline"
                    disabled={isPending || reason.trim().length < 4}
                    onClick={() =>
                      void runAction("rollback_config", {
                        revisionId: rollbackRevision.id,
                      })
                    }
                  >
                    Rollback to v{rollbackRevision.version}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  disabled={isPending || reason.trim().length < 4}
                  onClick={() => void handleReplacePc()}
                >
                  Replace PC
                </Button>
                <Button
                  variant="outline"
                  disabled={isPending || reason.trim().length < 4}
                  onClick={() => void runAction("rotate_credential")}
                >
                  Rotate device credential
                </Button>
                <Button
                  variant="destructive"
                  disabled={isPending || reason.trim().length < 4}
                  onClick={() => void runAction("revoke")}
                >
                  Revoke installation
                </Button>
              </div>
              {replacePairingCode ? (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 font-mono text-lg tracking-widest">
                  {replacePairingCode}
                </div>
              ) : null}
            </div>
          ) : null}

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Redacted topology</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!snapshot ? (
            <p className="text-muted-foreground">
              No commissioning snapshot yet. Complete local setup on the venue PC.
            </p>
          ) : (
            <>
              <div>
                <h4 className="font-medium">NVRs ({snapshot.nvrs?.length ?? 0})</h4>
                <ul className="mt-2 space-y-1">
                  {(snapshot.nvrs ?? []).map((nvr) => (
                    <li key={String(nvr.id)}>
                      {String(nvr.label)} · {String(nvr.host)} ·{" "}
                      {nvr.enabled ? "enabled" : "disabled"}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium">
                  Cameras ({snapshot.cameras?.length ?? 0})
                </h4>
                <ul className="mt-2 space-y-1">
                  {(snapshot.cameras ?? []).map((camera) => (
                    <li key={String(camera.id)}>
                      {String(camera.label)} · channel {String(camera.channelKey)} ·{" "}
                      {camera.enabled ? "enabled" : "disabled"}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium">Resource policies</h4>
                <ul className="mt-2 space-y-2">
                  {(snapshot.resourcePolicies ?? []).map((policy) => {
                    const resourceId = String(policy.resourceId ?? "")
                    const isManual =
                      policy.selectionMode === "manual" &&
                      typeof policy.manualSourceId === "string" &&
                      policy.manualSourceId.length > 0

                    return (
                      <li
                        key={resourceId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border p-2"
                      >
                        <span>
                          resource {resourceId} · {String(policy.selectionMode)}
                          {isManual
                            ? ` · pinned ${String(policy.manualSourceId)}`
                            : ""}
                        </span>
                        {canManage && isManual ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending || reason.trim().length < 4}
                            onClick={() => void clearResourceOverride(resourceId)}
                          >
                            Clear override
                          </Button>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
              <p className="text-muted-foreground">
                Reconfigure NVR passwords or run test capture from the local setup
                wizard on the venue PC (loopback). Cloud UI never collects NVR
                passwords.
              </p>
            </>
          )}

          {installation.reauthRequiredCount > 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              {installation.reauthRequiredCount} recorder credential reference(s)
              require local re-entry on the venue PC. Open the loopback setup wizard
              there; passwords are never entered in PlayTT cloud.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent capture attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {installation.recentCaptureAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No replay capture attempts recorded for this venue yet.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {installation.recentCaptureAttempts.map((attempt) => (
                <li key={attempt.id} className="rounded border p-3">
                  replay {attempt.replayRequestId} · source{" "}
                  {attempt.cameraSourceId} · {attempt.captureMode} ·{" "}
                  {attempt.status}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
