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

const POLL_MS = 5_000
const SUCCESS_MS = 4_000

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
  const pendingReplayIdRef = useRef<string | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)
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

  const applyStatusToView = useCallback(
    (next: KioskStatus, processing: boolean) => {
      if (processing) {
        setViewState("processing")
        return
      }

      if (next.status === "idle") {
        setViewState("idle")
        return
      }

      if (next.inFlightReplayRequestId) {
        setViewState("processing")
        return
      }

      setViewState("ready")
    },
    [],
  )

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      try {
        const next = await fetchStatus()

        if (!cancelled) {
          applyStatusToView(next, false)
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
            applyStatusToView(next, viewState === "processing")
          }
        })
        .catch(() => undefined)
    }, POLL_MS)

    return () => {
      clearInterval(interval)
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

        if (successTimerRef.current) {
          clearTimeout(successTimerRef.current)
        }

        successTimerRef.current = setTimeout(() => {
          void fetchStatus()
            .then((next) => applyStatusToView(next, false))
            .catch(() => {
              setViewState("ready")
            })
          successTimerRef.current = null
        }, SUCCESS_MS)
      } catch {
        // Ignore malformed replay hints.
      }
    })

    return () => {
      source.close()

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
      }
    }
  }, [applyStatusToView, fetchStatus, resourceId])

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
      idempotencyKeyRef.current = null

      setStatus((current) =>
        current
          ? {
              ...current,
              remainingCredits: result.remainingCredits,
              inFlightReplayRequestId: result.replayRequestId,
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
          <div className="max-w-lg text-center">
            <div
              className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-emerald-400"
              aria-hidden="true"
            />
            <p className="mt-8 text-2xl font-medium">Capturing replay…</p>
            <p className="mt-4 text-lg text-white/60">
              Clip will play on the TV when ready.
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
                setErrorMessage(null)
                void fetchStatus()
                  .then((next) => applyStatusToView(next, false))
                  .catch(() => setViewState("error"))
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
