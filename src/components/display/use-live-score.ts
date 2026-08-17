"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { ScoreState } from "@/server/scoring/types"

export interface DisplaySnapshotPayload {
  status: "idle" | "active"
  resource: {
    id: string
    tenantId: string
    locationId: string
    name: string
    slug: string
    code: string | null
  }
  playSession: {
    id: string
    bookingId: string
    status: string
    scheduledStartAt: string
    scheduledEndAt: string
  } | null
  snapshot: {
    id: string
    version: number
    state: ScoreState
    lastEventId: string | null
    updatedAt: string
  } | null
}

export interface ScoreHintPayload {
  playSessionId: string
  snapshotVersion: number
  eventId: string
  state?: ScoreState
}

function reconcileScoreHint(
  localVersion: number | null,
  hintVersion: number | null | undefined,
): "apply" | "refetch" | "noop" | "ignore" {
  if (hintVersion == null || Number.isNaN(hintVersion)) {
    return "ignore"
  }

  if (localVersion == null || Number.isNaN(localVersion)) {
    return "refetch"
  }

  if (hintVersion === localVersion) {
    return "noop"
  }

  if (hintVersion === localVersion + 1) {
    return "apply"
  }

  return "refetch"
}

const POLL_MS = 5_000

export function useLiveScore(resourceId: string) {
  const [payload, setPayload] = useState<DisplaySnapshotPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const versionRef = useRef<number | null>(null)

  const applyPayload = useCallback((next: DisplaySnapshotPayload) => {
    setPayload(next)
    versionRef.current = next.snapshot?.version ?? null
  }, [])

  const fetchSnapshot = useCallback(async () => {
    const response = await fetch(
      `/api/display/v1/resources/${encodeURIComponent(resourceId)}/snapshot`,
      { cache: "no-store" },
    )

    if (!response.ok) {
      throw new Error("Unable to load score snapshot.")
    }

    const body = (await response.json()) as { data: DisplaySnapshotPayload }
    applyPayload(body.data)
    setError(null)
  }, [applyPayload, resourceId])

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      setIsLoading(true)

      try {
        await fetchSnapshot()
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load score snapshot.",
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadInitial()

    return () => {
      cancelled = true
    }
  }, [fetchSnapshot])

  useEffect(() => {
    const source = new EventSource(
      `/api/display/v1/resources/${encodeURIComponent(resourceId)}/stream`,
    )

    source.addEventListener("score", (event) => {
      try {
        const hint = JSON.parse(event.data) as ScoreHintPayload
        const action = reconcileScoreHint(versionRef.current, hint.snapshotVersion)

        if (action === "apply" && hint.state) {
          setPayload((current) => {
            if (!current || current.status !== "active") {
              return current
            }

            return {
              ...current,
              snapshot: {
                id: current.snapshot?.id ?? hint.eventId,
                version: hint.snapshotVersion,
                state: hint.state!,
                lastEventId: hint.eventId,
                updatedAt: new Date().toISOString(),
              },
            }
          })
          versionRef.current = hint.snapshotVersion
          return
        }

        if (action === "refetch") {
          void fetchSnapshot().catch(() => {
            setError("Score stream fell behind. Retrying snapshot fetch.")
          })
        }
      } catch {
        void fetchSnapshot().catch(() => undefined)
      }
    })

    source.onerror = () => {
      void fetchSnapshot().catch(() => undefined)
    }

    return () => {
      source.close()
    }
  }, [fetchSnapshot, resourceId])

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchSnapshot().catch(() => undefined)
    }, POLL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [fetchSnapshot])

  return {
    payload,
    isLoading,
    error,
    refetch: fetchSnapshot,
  }
}
