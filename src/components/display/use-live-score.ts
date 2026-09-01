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

export interface ReplayOverlayPayload {
  replayId: string
  mediaId: string
  playbackUrl: string
}

// Safety timeout only. The video normally closes itself on `ended`, so a full
// 15-second replay is never cut short by the display overlay.
const REPLAY_OVERLAY_MS = 30_000
const POLL_MS = 5_000
const REPLAY_POLL_MS = 2_000
const RECENT_REPLAY_WINDOW_MS = 60_000
const PLAYBACK_RETRY_DELAYS_MS = [0, 250, 500, 1_000] as const

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs))
}

export function useLiveScore(resourceId: string) {
  const [payload, setPayload] = useState<DisplaySnapshotPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replayOverlay, setReplayOverlay] = useState<ReplayOverlayPayload | null>(
    null,
  )
  const versionRef = useRef<number | null>(null)
  const lastReplayIdRef = useRef<string | null>(null)
  const loadingReplayIdRef = useRef<string | null>(null)
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyPayload = useCallback((next: DisplaySnapshotPayload) => {
    setPayload(next)
    versionRef.current = next.snapshot?.version ?? null
  }, [])

  const dismissReplayOverlay = useCallback(() => {
    setReplayOverlay(null)
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current)
      overlayTimerRef.current = null
    }
  }, [])

  const loadReplayOverlay = useCallback(
    async (replayId: string) => {
      if (
        lastReplayIdRef.current === replayId ||
        loadingReplayIdRef.current === replayId
      ) {
        return
      }

      loadingReplayIdRef.current = replayId

      try {
        for (const delayMs of PLAYBACK_RETRY_DELAYS_MS) {
          if (delayMs > 0) {
            await wait(delayMs)
          }

          const response = await fetch(
            `/api/display/v1/resources/${encodeURIComponent(resourceId)}/replays/${encodeURIComponent(replayId)}/playback`,
            { cache: "no-store" },
          )

          if (!response.ok) {
            continue
          }

          const body = (await response.json()) as {
            data?: { playback?: { url?: string; mediaId?: string } }
          }
          const playback = body.data?.playback

          if (!playback?.url) {
            continue
          }

          lastReplayIdRef.current = replayId
          setReplayOverlay({
            replayId,
            mediaId: playback.mediaId ?? "",
            playbackUrl: playback.url,
          })

          if (overlayTimerRef.current) {
            clearTimeout(overlayTimerRef.current)
          }
          overlayTimerRef.current = setTimeout(() => {
            setReplayOverlay(null)
            overlayTimerRef.current = null
          }, REPLAY_OVERLAY_MS)
          return
        }
      } catch {
        // Polling or the durable broadcast will retry discovery.
      } finally {
        loadingReplayIdRef.current = null
      }
    },
    [resourceId],
  )

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

    source.addEventListener("replay", (event) => {
      try {
        const hint = JSON.parse(event.data) as { replayId?: string }

        if (!hint.replayId) {
          return
        }

        void loadReplayOverlay(hint.replayId)
      } catch {
        // Ignore malformed replay hints.
      }
    })

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
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current)
      }
      source.close()
    }
  }, [fetchSnapshot, loadReplayOverlay, resourceId])

  useEffect(() => {
    async function discoverReadyReplay() {
      try {
        const response = await fetch(
          `/api/display/v1/resources/${encodeURIComponent(resourceId)}/replay-requests`,
          { cache: "no-store" },
        )
        if (!response.ok) {
          return
        }

        const body = (await response.json()) as {
          data?: {
            latestReplay?: {
              replayId?: string
              status?: string
              readyAt?: string | null
            } | null
          }
        }
        const latest = body.data?.latestReplay
        const readyAt = latest?.readyAt
          ? new Date(latest.readyAt).getTime()
          : Number.NaN

        if (
          latest?.status === "ready" &&
          latest.replayId &&
          Number.isFinite(readyAt) &&
          Date.now() - readyAt <= RECENT_REPLAY_WINDOW_MS
        ) {
          await loadReplayOverlay(latest.replayId)
        }
      } catch {
        // The realtime stream remains the primary path.
      }
    }

    void discoverReadyReplay()
    const interval = setInterval(discoverReadyReplay, REPLAY_POLL_MS)
    return () => clearInterval(interval)
  }, [loadReplayOverlay, resourceId])

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
    replayOverlay,
    dismissReplayOverlay,
    refetch: fetchSnapshot,
  }
}
