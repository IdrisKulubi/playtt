"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type KioskStatus = {
  status: "idle" | "active"
  resource: {
    id: string
    name: string
    code: string | null
  }
  playSession: {
    id: string
  } | null
  remainingCredits: number | null
  inFlightReplayRequestId: string | null
  inFlightReplay: {
    id: string
    status: string
    requestedAt: string
  } | null
  latestReplay: {
    id: string
    replayId: string
    status: string
    failureReason: string | null
    readyAt: string | null
  } | null
}

const CAPTURE_FAILURE_STATUSES = new Set([
  "failed",
  "expired",
  "extraction_failed",
  "buffer_missing",
  "upload_failed",
  "edge_offline",
])

function describeCaptureFailure(status: string, reason: string | null) {
  if (status === "buffer_missing") {
    return "No camera buffer yet. Wait a few seconds after VenueEdge starts, then try again."
  }

  if (status === "extraction_failed") {
    return "Could not cut the clip. Check the camera stream and try again."
  }

  if (status === "upload_failed") {
    return "Clip upload failed. Check internet on the venue PC and try again."
  }

  if (status === "edge_offline") {
    return "Replay capture is offline. Ask staff for help."
  }

  if (reason === "resource_not_configured" || reason === "no_source_configured") {
    return "This table is not mapped to a camera. Map it in VenueEdge setup, then try again."
  }

  if (reason === "stale_config") {
    return "VenueEdge config changed during capture. Tap Replay again."
  }

  if (reason === "capture_command_expired") {
    return "Capture timed out before VenueEdge picked it up. Tap Replay again."
  }

  return reason || "Could not capture replay."
}

type ReplayRequestResult = {
  replayRequestId: string
  replayId: string
  status: string
  remainingCredits: number
}

type ViewState =
  | "loading"
  | "idle"
  | "ready"
  | "processing"
  | "success"
  | "error"

const IDLE_POLL_MS = 5_000
const PROCESSING_POLL_MS = 1_000
const SUCCESS_MS = 4_000

const CAPTURE_STAGES = [
  {
    statuses: ["requested", "authorized", "dispatched"],
    label: "Starting capture",
    detail: "Sending the replay request to the venue recorder.",
  },
  {
    statuses: ["edge_acknowledged", "capturing"],
    label: "Capturing the moment",
    detail: "Collecting the buffered video from your table.",
  },
  {
    statuses: ["extracting"],
    label: "Cutting your clip",
    detail: "Building the full replay around the moment you tapped.",
  },
  {
    statuses: ["uploading", "verifying"],
    label: "Finishing up",
    detail: "Preparing playback for the TV and your library.",
  },
] as const

function captureStage(status: string | undefined) {
  const index = Math.max(
    0,
    CAPTURE_STAGES.findIndex((stage) =>
      (stage.statuses as readonly string[]).includes(status ?? ""),
    ),
  )
  return { ...CAPTURE_STAGES[index], index }
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function mapReplayError(code: string | undefined, message: string) {
  switch (code) {
    case "NO_CREDITS":
      return "No clip credits left. Buy a clip pack in the app."
    case "VENUE_EDGE_UNAVAILABLE":
      return "Replay capture is offline. Ask staff for help."
    case "REPLAY_IN_FLIGHT":
      return "A replay is already being captured."
    case "SESSION_NOT_ACTIVE":
      return "No active booking on this table."
    case "REPLAY_EDGE_DISABLED":
    case "PRIVATE_MEDIA_DISABLED":
      return "Replay capture is not enabled for this venue."
    default:
      return message
  }
}

export function TableReplayKiosk({ resourceId }: { resourceId: string }) {
  const [status, setStatus] = useState<KioskStatus | null>(null)
  const [viewState, setViewState] = useState<ViewState>("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const pendingReplayIdRef = useRef<string | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)
  const dismissedFailureIdRef = useRef<string | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchStatus = useCallback(async () => {
    const response = await fetch(
      `/api/display/v1/resources/${encodeURIComponent(resourceId)}/replay-requests`,
      { cache: "no-store" },
    )

    if (!response.ok) {
      throw new Error("Unable to load replay kiosk status.")
    }

    const body = (await response.json()) as { data: KioskStatus }
    setStatus(body.data)
    return body.data
  }, [resourceId])

  const applyStatusToView = useCallback((next: KioskStatus) => {
    if (next.status === "idle") {
      setViewState("idle")
      return
    }

    if (next.inFlightReplayRequestId) {
      setViewState("processing")
      return
    }

    if (
      pendingReplayIdRef.current &&
      next.latestReplay?.status === "ready" &&
      next.latestReplay.replayId === pendingReplayIdRef.current
    ) {
      pendingReplayIdRef.current = null
      idempotencyKeyRef.current = null
      setViewState("success")
      setErrorMessage(null)
      return
    }

    if (
      next.latestReplay &&
      CAPTURE_FAILURE_STATUSES.has(next.latestReplay.status) &&
      next.latestReplay.id !== dismissedFailureIdRef.current
    ) {
      setViewState("error")
      setErrorMessage(
        describeCaptureFailure(
          next.latestReplay.status,
          next.latestReplay.failureReason,
        ),
      )
      return
    }

    setViewState("ready")
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      try {
        const next = await fetchStatus()

        if (!cancelled) {
          applyStatusToView(next)
          setErrorMessage(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setViewState("error")
          setErrorMessage(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load replay kiosk.",
          )
        }
      }
    }

    void loadInitial()

    return () => {
      cancelled = true
    }
  }, [applyStatusToView, fetchStatus])

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchStatus()
        .then((next) => {
          if (viewState !== "success") {
            applyStatusToView(next)
          }
        })
        .catch(() => undefined)
    }, viewState === "processing" ? PROCESSING_POLL_MS : IDLE_POLL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [applyStatusToView, fetchStatus, viewState])

  useEffect(() => {
    if (viewState !== "processing") {
      setElapsedSeconds(0)
      return
    }

    const startedAt = status?.inFlightReplay?.requestedAt
      ? new Date(status.inFlightReplay.requestedAt).getTime()
      : Date.now()
    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    }
    updateElapsed()
    const timer = setInterval(updateElapsed, 1_000)
    return () => clearInterval(timer)
  }, [status?.inFlightReplay?.requestedAt, viewState])

  useEffect(() => {
    if (viewState !== "success") {
      return
    }

    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
    }

    successTimerRef.current = setTimeout(() => {
      void fetchStatus()
        .then((next) => applyStatusToView(next))
        .catch(() => setViewState("ready"))
      successTimerRef.current = null
    }, SUCCESS_MS)

    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
        successTimerRef.current = null
      }
    }
  }, [applyStatusToView, fetchStatus, viewState])

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

        if (
          pendingReplayIdRef.current &&
          hint.replayId !== pendingReplayIdRef.current
        ) {
          return
        }

        pendingReplayIdRef.current = null
        idempotencyKeyRef.current = null
        setViewState("success")
        setErrorMessage(null)
      } catch {
        // Ignore malformed replay hints.
      }
    })

    return () => {
      source.close()
    }
  }, [resourceId])

  const handleReplayTap = async () => {
    if (viewState === "processing") {
      return
    }

    const clientIdempotencyKey =
      idempotencyKeyRef.current ?? createIdempotencyKey()
    idempotencyKeyRef.current = clientIdempotencyKey

    setViewState("processing")
    setErrorMessage(null)

    try {
      const response = await fetch(
        `/api/display/v1/resources/${encodeURIComponent(resourceId)}/replay-requests`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clientIdempotencyKey }),
        },
      )

      const body = (await response.json()) as {
        data?: ReplayRequestResult
        code?: string
        message?: string
      }

      if (!response.ok) {
        idempotencyKeyRef.current = null
        setViewState("error")
        setErrorMessage(
          mapReplayError(body.code, body.message ?? "Replay capture failed."),
        )
        return
      }

      const result = body.data

      if (!result) {
        idempotencyKeyRef.current = null
        setViewState("error")
        setErrorMessage("Replay capture failed.")
        return
      }

      pendingReplayIdRef.current = result.replayId
      dismissedFailureIdRef.current = null
      idempotencyKeyRef.current = null

      setStatus((current) =>
        current
          ? {
              ...current,
              remainingCredits: result.remainingCredits,
              inFlightReplayRequestId: result.replayRequestId,
              inFlightReplay: {
                id: result.replayRequestId,
                status: result.status,
                requestedAt: new Date().toISOString(),
              },
            }
          : current,
      )
    } catch {
      idempotencyKeyRef.current = null
      setViewState("error")
      setErrorMessage("Network error. Check the connection and try again.")
    }
  }

  const tableLabel =
    status?.resource.code ?? status?.resource.name ?? "This table"

  if (viewState === "loading" && !status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white/70">
        Loading replay kiosk…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#050505] text-white">
      <header className="border-b border-white/10 px-6 py-5">
        <p className="text-sm uppercase tracking-[0.2em] text-white/50">
          PlayTT Replay
        </p>
        <h1 className="mt-1 text-3xl font-semibold">{tableLabel}</h1>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        {viewState === "idle" ? (
          <div className="max-w-lg text-center">
            <p className="text-2xl font-medium text-white/90">No session</p>
            <p className="mt-4 text-lg text-white/60">
              Start a booking to capture highlights from this table.
            </p>
          </div>
        ) : null}

        {viewState === "ready" ? (
          <div className="flex w-full max-w-xl flex-col items-center gap-6">
            {status?.remainingCredits != null ? (
              <p className="text-lg text-white/60">
                {status.remainingCredits} clip
                {status.remainingCredits === 1 ? "" : "s"} remaining
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleReplayTap()}
              className="flex h-44 w-full max-w-md items-center justify-center rounded-3xl bg-emerald-500 text-4xl font-bold text-black shadow-[0_0_60px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 active:scale-[0.98]"
            >
              Replay
            </button>
            <p className="text-center text-white/50">
              Tap to save the last rally to your library and play it on the TV.
            </p>
          </div>
        ) : null}

        {viewState === "processing" ? (
          <div
            className="w-full max-w-lg text-center"
            role="status"
            aria-live="polite"
          >
            <div
              className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-emerald-400 motion-reduce:animate-none"
              aria-hidden="true"
            />
            <p className="mt-8 text-2xl font-medium">
              {captureStage(status?.inFlightReplay?.status).label}
            </p>
            <p className="mt-4 text-lg text-white/60">
              {captureStage(status?.inFlightReplay?.status).detail}
            </p>
            <div
              className="mx-auto mt-8 flex max-w-sm gap-2"
              aria-label={`Replay step ${captureStage(status?.inFlightReplay?.status).index + 1} of ${CAPTURE_STAGES.length}`}
            >
              {CAPTURE_STAGES.map((stage, index) => (
                <span
                  key={stage.label}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${index <= captureStage(status?.inFlightReplay?.status).index ? "bg-emerald-400" : "bg-white/20"}`}
                />
              ))}
            </div>
            <p className="mt-5 tabular-nums text-sm text-white/50">
              {elapsedSeconds}s elapsed · Most replays are ready in about 15 seconds
            </p>
            <p className="mt-2 text-sm text-white/50">
              It will play on the TV first, then we’ll send the email.
            </p>
          </div>
        ) : null}

        {viewState === "success" ? (
          <div className="max-w-lg text-center">
            <p className="text-3xl font-semibold text-emerald-400">
              Clip saved
            </p>
            <p className="mt-4 text-lg text-white/70">
              Playing on the TV. Check your email and app library.
            </p>
          </div>
        ) : null}

        {viewState === "error" ? (
          <div className="max-w-lg text-center">
            <p className="text-2xl font-medium text-red-400">
              Could not capture replay
            </p>
            <p className="mt-4 text-lg text-white/70">
              {errorMessage ?? "Something went wrong."}
            </p>
            <button
              type="button"
              onClick={() => {
                dismissedFailureIdRef.current =
                  status?.latestReplay?.id ?? null
                setErrorMessage(null)
                setViewState("ready")
              }}
              className="mt-8 rounded-2xl border border-white/20 px-6 py-3 text-lg text-white/80 hover:bg-white/5"
            >
              Try again
            </button>
          </div>
        ) : null}
      </main>
    </div>
  )
}
