"use client"

import { useCallback, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  OPERATOR_CANCELABLE_REPLAY_REQUEST_STATUSES,
  OPERATOR_RETRYABLE_REPLAY_REQUEST_STATUSES,
} from "@/server/replays/constants"

export interface OperatorReplayRequestRow {
  id: string
  resourceId: string
  resourceName: string
  status: string
  failureReason: string | null
  attempts: number
  maxAttempts: number
  createdAt: string
  updatedAt: string
}

export interface OperatorEdgeCapacitySnapshot {
  deviceId: string
  lastHeartbeatAt: string | null
  health: string
  metrics: {
    activeReplayJobs: number
    replayQueueDepth: number
    maxConcurrentReplays: number
    ffmpegRunning: boolean
  }
}

export function OperatorReplayRequestsPanel({
  venueId,
  initialRequests,
  edgeCapacity,
  canManage = false,
}: {
  venueId: string
  initialRequests: OperatorReplayRequestRow[]
  edgeCapacity: OperatorEdgeCapacitySnapshot | null
  canManage?: boolean
}) {
  const [requests, setRequests] = useState(initialRequests)
  const [capacity, setCapacity] = useState(edgeCapacity)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/operator/venues/${venueId}/replay-requests`)
    if (!response.ok) {
      throw new Error("Could not refresh replay requests.")
    }

    const payload = await response.json()
    setRequests(payload.data?.replayRequests ?? [])
    setCapacity(payload.data?.edgeCapacity ?? null)
  }, [venueId])

  const handleRetry = async (replayRequestId: string) => {
    setBusyId(replayRequestId)
    setError(null)

    try {
      const response = await fetch(
        `/api/operator/replay-requests/${replayRequestId}/retry`,
        { method: "POST" },
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error?.message ?? "Retry failed.")
      }

      await refresh()
    } catch (retryError) {
      setError(
        retryError instanceof Error ? retryError.message : "Retry failed.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (replayRequestId: string) => {
    setBusyId(replayRequestId)
    setError(null)

    try {
      const response = await fetch(
        `/api/operator/replay-requests/${replayRequestId}/cancel`,
        { method: "POST", body: JSON.stringify({}) },
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error?.message ?? "Cancel failed.")
      }

      await refresh()
    } catch (cancelError) {
      setError(
        cancelError instanceof Error ? cancelError.message : "Cancel failed.",
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Replay capture</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {capacity ? (
          <div className="rounded-xl border border-white/8 bg-background/30 p-3 text-sm text-muted-foreground">
            <p>
              Venue edge:{" "}
              <Badge variant="outline">{capacity.health}</Badge>
              {capacity.lastHeartbeatAt
                ? ` · last heartbeat ${new Date(
                    capacity.lastHeartbeatAt,
                  ).toLocaleString()}`
                : null}
            </p>
            <p className="mt-2">
              Active jobs {capacity.metrics.activeReplayJobs} /{" "}
              {capacity.metrics.maxConcurrentReplays} · queue{" "}
              {capacity.metrics.replayQueueDepth} · buffer{" "}
              {capacity.metrics.ffmpegRunning ? "running" : "stopped"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No venue edge device registered for this venue.
          </p>
        )}

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No replay requests yet for this venue.
          </p>
        ) : (
          <div className="space-y-2">
            {requests.map((request) => {
              const canRetry =
                canManage &&
                (OPERATOR_RETRYABLE_REPLAY_REQUEST_STATUSES as readonly string[]).includes(
                  request.status,
                ) &&
                request.attempts < request.maxAttempts
              const canCancel =
                canManage &&
                (OPERATOR_CANCELABLE_REPLAY_REQUEST_STATUSES as readonly string[]).includes(
                  request.status,
                )

              return (
                <div
                  key={request.id}
                  className="rounded-xl border border-white/8 bg-background/30 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{request.resourceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {request.status} · attempt {request.attempts}/
                        {request.maxAttempts} ·{" "}
                        {new Date(request.updatedAt).toLocaleString()}
                      </p>
                      {request.failureReason ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {request.failureReason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canRetry ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === request.id}
                          onClick={() => handleRetry(request.id)}
                        >
                          Retry
                        </Button>
                      ) : null}
                      {canCancel ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === request.id}
                          onClick={() => handleCancel(request.id)}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
