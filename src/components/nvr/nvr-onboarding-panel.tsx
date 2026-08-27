"use client"

import { useCallback, useEffect, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { VenueEdgeInstallerArtifactMetadata } from "@/server/replays/venue-edge-installer-metadata"
import type { VenueEdgePairingSessionView } from "@/server/replays/venue-edge-pairing-sessions"

type CreatedPairingSession = VenueEdgePairingSessionView & {
  pairingCode: string
}

const LIFECYCLE_LABELS: Record<string, string> = {
  waiting_for_install: "Waiting for install",
  pending_setup: "Pending setup",
  online: "Online",
  expired: "Expired",
  revoked: "Revoked",
  cancelled: "Cancelled",
}

function lifecycleVariant(status: string) {
  if (status === "online") return "default"
  if (status === "pending_setup") return "secondary"
  if (status === "waiting_for_install") return "outline"
  return "outline"
}

export function NvrOnboardingPanel({
  selectedVenueId,
  canManage,
  installer,
  initialSessions,
}: {
  selectedVenueId: string
  canManage: boolean
  installer: VenueEdgeInstallerArtifactMetadata
  initialSessions: VenueEdgePairingSessionView[]
}) {
  const [sessions, setSessions] =
    useState<VenueEdgePairingSessionView[]>(initialSessions)
  const [freshPairingCode, setFreshPairingCode] = useState<string | null>(null)
  const [freshPairingExpiresAt, setFreshPairingExpiresAt] = useState<string | null>(
    null,
  )
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const refreshSessions = useCallback(async () => {
    const response = await fetch(
      `/api/operator/venue-edge/pairing-sessions?locationId=${selectedVenueId}`,
    )

    if (!response.ok) {
      return
    }

    const payload = (await response.json()) as {
      data?: { sessions?: VenueEdgePairingSessionView[] }
    }

    setSessions(payload.data?.sessions ?? [])
  }, [selectedVenueId])

  useEffect(() => {
    setFreshPairingCode(null)
    setFreshPairingExpiresAt(null)
    setSessions(initialSessions)
  }, [initialSessions, selectedVenueId])

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshSessions()
    }, 8_000)

    return () => clearInterval(timer)
  }, [refreshSessions])

  async function handleCreatePairing() {
    setMessage(null)
    setFreshPairingCode(null)
    setFreshPairingExpiresAt(null)

    const response = await fetch("/api/operator/venue-edge/pairing-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: selectedVenueId }),
    })

    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not create pairing session.")
      return
    }

    const payload = (await response.json()) as {
      data?: { session?: CreatedPairingSession }
    }
    const session = payload.data?.session

    if (!session?.pairingCode) {
      setMessage("Pairing session was created without a displayable code.")
      return
    }

    setFreshPairingCode(session.pairingCode)
    setFreshPairingExpiresAt(session.expiresAt)
    startTransition(() => {
      void refreshSessions()
    })
  }

  async function handleCancel(sessionId: string) {
    setMessage(null)

    const response = await fetch(
      `/api/operator/venue-edge/pairing-sessions/${sessionId}/cancel`,
      { method: "POST" },
    )

    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not cancel pairing session.")
      return
    }

    setFreshPairingCode(null)
    startTransition(() => {
      void refreshSessions()
    })
  }

  async function handleReissue(sessionId: string) {
    setMessage(null)
    setFreshPairingCode(null)
    setFreshPairingExpiresAt(null)

    const response = await fetch(
      `/api/operator/venue-edge/pairing-sessions/${sessionId}/reissue`,
      { method: "POST" },
    )

    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not reissue pairing session.")
      return
    }

    const payload = (await response.json()) as {
      data?: { session?: CreatedPairingSession }
    }
    const session = payload.data?.session

    if (session?.pairingCode) {
      setFreshPairingCode(session.pairingCode)
      setFreshPairingExpiresAt(session.expiresAt)
    }

    startTransition(() => {
      void refreshSessions()
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>VenueEdge installer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Channel: <span className="text-foreground">{installer.channel}</span>
          </p>
          <p>
            Version: <span className="text-foreground">{installer.version}</span>
          </p>
          <p>
            Minimum agent:{" "}
            <span className="text-foreground">{installer.minimumAgentVersion}</span>
          </p>
          <p>{installer.releaseNotes}</p>
          {installer.downloadUrl ? (
            <a
              href={installer.downloadUrl}
              className="text-primary underline-offset-4 hover:underline"
            >
              Download installer
            </a>
          ) : (
            <p className="text-foreground">
              Signed download URL will appear here in Phase 5.
            </p>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Add VenueEdge</CardTitle>
            <Button onClick={() => void handleCreatePairing()} disabled={isPending}>
              Create pairing code
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {freshPairingCode ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium text-foreground">
                  Pairing code (shown once)
                </p>
                <p className="mt-2 font-mono text-2xl tracking-widest text-foreground">
                  {freshPairingCode}
                </p>
                {freshPairingExpiresAt ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Expires {new Date(freshPairingExpiresAt).toLocaleString()}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter this code in the VenueEdge Agent during first boot. Device
                  secrets are never shown in this UI.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Create a one-time pairing code for a new VenueEdge installation at
                this venue.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            You can view pairing status but do not have permission to create codes.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pairing sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pairing sessions for this venue yet.
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-3 rounded-xl border border-white/8 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={lifecycleVariant(session.lifecycleStatus)}>
                      {LIFECYCLE_LABELS[session.lifecycleStatus] ??
                        session.lifecycleStatus}
                    </Badge>
                    <span className="text-muted-foreground">
                      hint …{session.codeHint}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    Expires {new Date(session.expiresAt).toLocaleString()}
                  </p>
                  {session.consumedAt ? (
                    <p className="text-muted-foreground">
                      Consumed {new Date(session.consumedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>

                    {session.status === "waiting_for_install" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => void handleCancel(session.id)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isPending}
                          onClick={() => void handleReissue(session.id)}
                        >
                          Reissue code
                        </Button>
                      </>
                    ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  )
}
