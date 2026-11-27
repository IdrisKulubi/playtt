"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useLiveScore } from "@/components/display/use-live-score"
import { useNow } from "@/components/display/tv-scenes"
import { TableFreeState } from "@/components/replay/table-free-state"
import {
  NETWORK_NOTICE,
  noticeForCaptureFailure,
  noticeForRequestError,
  type KioskNotice,
} from "@/components/replay/replay-notices"
import { TableMatchControls } from "@/components/replay/table-match-controls"
import { TABLET_INK, TabletBackdrop } from "@/components/replay/tablet-backdrop"

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
    /** When it last changed; older servers don't send it. */
    updatedAt?: string
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

const dateFormatter = new Intl.DateTimeFormat("en-KE", {
  weekday: "short",
  day: "numeric",
  month: "short",
})

const RECENT_FAILURE_MS = 2 * 60_000

function isRecentFailure(updatedAt: string | undefined) {
  if (!updatedAt) return true
  return Date.now() - Date.parse(updatedAt) < RECENT_FAILURE_MS
}

const IDLE_POLL_MS = 5_000
const PROCESSING_POLL_MS = 1_000
const SUCCESS_MS = 4_000
/**
 * After a tap, polls that don't mention the new request yet are stale (the
 * POST hasn't committed, or a read raced it). They're ignored for this long
 * since the request was last seen, so the screen never flips back to the
 * buttons mid-capture.
 */
const PENDING_STALE_GRACE_MS = 15_000
/** A capture that's been "in progress" this long is treated as lost. */
const PENDING_MAX_MS = 3 * 60_000

type PendingReplay = {
  replayRequestId: string | null
  replayId: string | null
  startedAt: number
  lastSeenAt: number
}

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

export function TableReplayKiosk({ resourceId }: { resourceId: string }) {
  const [status, setStatus] = useState<KioskStatus | null>(null)
  const [viewState, setViewState] = useState<ViewState>("loading")
  const [notice, setNotice] = useState<KioskNotice | null>(null)
  // The tap we're waiting on. While set, stale polls can't reset the screen.
  const pendingRef = useRef<PendingReplay | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)
  const dismissedFailureIdRef = useRef<string | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Responses can land out of order; only the newest request may update state.
  const fetchSeqRef = useRef(0)
  const appliedSeqRef = useRef(0)
  // Match state comes from the same snapshot + stream the TV reads.
  const live = useLiveScore(resourceId, { replayOverlay: false })
  const now = useNow(30_000)

  const fetchStatus = useCallback(async (): Promise<KioskStatus | null> => {
    const seq = ++fetchSeqRef.current
    const response = await fetch(
      `/api/display/v1/resources/${encodeURIComponent(resourceId)}/replay-requests`,
      { cache: "no-store" },
    )

    if (!response.ok) {
      throw new Error("Unable to load replay kiosk status.")
    }

    const body = (await response.json()) as { data: KioskStatus }

    if (seq < appliedSeqRef.current) {
      // A newer response already landed; this one would roll the screen back.
      return null
    }
    appliedSeqRef.current = seq

    setStatus((current) => {
      const pending = pendingRef.current
      // Keep the optimistic in-flight info until the server reports it.
      if (pending && !body.data.inFlightReplayRequestId && current?.inFlightReplay) {
        return { ...body.data, inFlightReplayRequestId: current.inFlightReplayRequestId, inFlightReplay: current.inFlightReplay }
      }
      return body.data
    })
    return body.data
  }, [resourceId])

  const finishPending = useCallback(() => {
    pendingRef.current = null
    idempotencyKeyRef.current = null
  }, [])

  const applyStatusToView = useCallback((next: KioskStatus | null) => {
    if (!next) return

    const pending = pendingRef.current
    if (pending) {
      const nowMs = Date.now()
      const inFlightId = next.inFlightReplayRequestId

      if (
        inFlightId &&
        (pending.replayRequestId === null || pending.replayRequestId === inFlightId)
      ) {
        pending.lastSeenAt = nowMs
        if (nowMs - pending.startedAt < PENDING_MAX_MS) {
          setViewState("processing")
          return
        }
      }

      const latest = next.latestReplay
      if (pending.replayId && latest?.replayId === pending.replayId) {
        if (latest.status === "ready") {
          finishPending()
          setViewState("success")
          setNotice(null)
          return
        }

        if (CAPTURE_FAILURE_STATUSES.has(latest.status)) {
          finishPending()
          setViewState("error")
          setNotice(noticeForCaptureFailure(latest.status, latest.failureReason))
          return
        }
      }

      // This snapshot doesn't know about the tap yet: keep the progress screen.
      if (
        nowMs - pending.lastSeenAt < PENDING_STALE_GRACE_MS &&
        nowMs - pending.startedAt < PENDING_MAX_MS
      ) {
        setViewState("processing")
        return
      }

      // Lost track of it (session ended, or the request vanished).
      finishPending()
    }

    if (next.status === "idle") {
      setViewState("idle")
      return
    }

    if (next.inFlightReplayRequestId) {
      setViewState("processing")
      return
    }

    if (
      next.latestReplay &&
      CAPTURE_FAILURE_STATUSES.has(next.latestReplay.status) &&
      next.latestReplay.id !== dismissedFailureIdRef.current &&
      // Only a failure from just now is news; an old one shouldn't greet the
      // next people who walk up to the table.
      isRecentFailure(next.latestReplay.updatedAt)
    ) {
      setViewState("error")
      setNotice(
        noticeForCaptureFailure(
          next.latestReplay.status,
          next.latestReplay.failureReason,
        ),
      )
      return
    }

    setViewState("ready")
  }, [finishPending])

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      try {
        const next = await fetchStatus()

        if (!cancelled) {
          // applyStatusToView sets (or clears) the notice itself; clearing it
          // here left a failed replay as an empty card.
          applyStatusToView(next)
        }
      } catch {
        if (!cancelled) {
          setViewState("error")
          setNotice(NETWORK_NOTICE)
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
          // A notice stays until it's closed or times out.
          if (viewState !== "success" && viewState !== "error") {
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

        const pending = pendingRef.current
        // Mid-tap (POST not back yet) we can't tell whose clip this is; the
        // next poll will match it by id instead.
        if (pending && hint.replayId !== pending.replayId) {
          return
        }

        finishPending()
        setViewState("success")
        setNotice(null)
      } catch {
        // Ignore malformed replay hints.
      }
    })

    return () => {
      source.close()
    }
  }, [finishPending, resourceId])

  const closeNotice = useCallback(() => {
    dismissedFailureIdRef.current = status?.latestReplay?.id ?? null
    setNotice(null)
    setViewState("ready")
    // Back to whatever the table is doing now (it may have no session).
    void fetchStatus()
      .then((next) => applyStatusToView(next))
      .catch(() => undefined)
  }, [applyStatusToView, fetchStatus, status?.latestReplay?.id])

  useEffect(() => {
    if (viewState !== "error" || !notice?.autoDismissMs) return
    const timer = setTimeout(closeNotice, notice.autoDismissMs)
    return () => clearTimeout(timer)
  }, [closeNotice, notice, viewState])

  const handleReplayTap = async () => {
    if (viewState === "processing" || pendingRef.current) {
      return
    }

    // Reused after a network failure, so a retry can't charge twice for a
    // request the server did receive.
    const clientIdempotencyKey =
      idempotencyKeyRef.current ?? createIdempotencyKey()
    idempotencyKeyRef.current = clientIdempotencyKey

    const tappedAt = Date.now()
    pendingRef.current = {
      replayRequestId: null,
      replayId: null,
      startedAt: tappedAt,
      lastSeenAt: tappedAt,
    }
    setViewState("processing")
    setNotice(null)

    try {
      const response = await fetch(
        `/api/display/v1/resources/${encodeURIComponent(resourceId)}/replay-requests`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clientIdempotencyKey }),
        },
      )

      const body = (await response.json().catch(() => ({}))) as {
        data?: ReplayRequestResult
        code?: string
        message?: string
      }

      if (!response.ok) {
        finishPending()
        if (body.code === "REPLAY_IN_FLIGHT") {
          // Someone already tapped: follow that capture instead of erroring.
          setViewState("processing")
          void fetchStatus()
            .then((next) => applyStatusToView(next))
            .catch(() => undefined)
          return
        }
        setViewState("error")
        setNotice(noticeForRequestError(body.code))
        return
      }

      const result = body.data

      if (!result) {
        finishPending()
        setViewState("error")
        setNotice(noticeForRequestError(undefined))
        return
      }

      if (pendingRef.current) {
        pendingRef.current.replayRequestId = result.replayRequestId
        pendingRef.current.replayId = result.replayId
        pendingRef.current.lastSeenAt = Date.now()
      }
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
                requestedAt: new Date(tappedAt).toISOString(),
              },
            }
          : current,
      )
    } catch {
      // Keep the idempotency key: if the server did get it, the retry reuses it.
      pendingRef.current = null
      setViewState("error")
      setNotice(NETWORK_NOTICE)
    }
  }

  const tableLabel =
    status?.resource.code ?? status?.resource.name ?? "This table"

  if (viewState === "loading" && !status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#041019] text-white/70">
        Loading…
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#041019] text-white">
      <TabletBackdrop />
      {/* Table · logo · date, like the TV's top bar. */}
      <header
        className="relative grid grid-cols-3 items-center px-8 pt-7 pb-4"
        style={{ color: TABLET_INK.ink }}
      >
        <h1 className="truncate text-4xl font-bold tracking-[-0.03em]">{tableLabel}</h1>
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={TABLET_INK.logo}
            alt="PlayTT"
            className="h-12 w-auto"
            style={{ filter: TABLET_INK.logoFilter }}
          />
        </div>
        <p className="text-right text-xl font-semibold">{dateFormatter.format(new Date(now))}</p>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6 pb-10">
        {/* Navy glass panel: the controls stay legible on any background. */}
        <div className="flex w-full max-w-3xl flex-col items-center rounded-[2.25rem] border border-white/10 bg-[#041019]/92 px-8 py-12 shadow-[0_2.5rem_6rem_rgb(4_16_25/0.35)] backdrop-blur-2xl">
        {viewState === "idle" ? (
          <TableFreeState schedule={live.payload?.schedule} now={now} />
        ) : null}

        {viewState === "ready" || (viewState === "error" && !notice) ? (
          <TableMatchControls
            resourceId={resourceId}
            state={live.payload?.status === "active" ? (live.payload.snapshot?.state ?? null) : null}
            onChanged={() => void live.refetch().catch(() => undefined)}
            replayButton={(size) => (
              <button
                type="button"
                onClick={() => void handleReplayTap()}
                className={
                  size === "hero"
                    ? "flex h-44 w-full items-center justify-center rounded-3xl bg-[#00b7ff] text-4xl font-bold text-[#041019] shadow-[0_0_60px_rgba(0,183,255,0.35)] transition hover:bg-[#33c5ff] active:scale-[0.98]"
                    : "flex h-20 w-full items-center justify-center rounded-3xl border border-white/20 text-2xl font-semibold text-white transition active:scale-[0.98] active:bg-white/5"
                }
              >
                Replay
              </button>
            )}
            replayNote={
              <p className="text-center text-white/50">
                Tap Replay to save the last rally to your library and play it on the TV.
                {status?.remainingCredits != null
                  ? ` ${status.remainingCredits} clip${status.remainingCredits === 1 ? "" : "s"} left.`
                  : ""}
              </p>
            }
          />
        ) : null}

        {viewState === "processing" ? (
          <div
            className="w-full max-w-lg text-center"
            role="status"
            aria-live="polite"
          >
            <div
              className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-[#00b7ff] motion-reduce:animate-none"
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
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${index <= captureStage(status?.inFlightReplay?.status).index ? "bg-[#00b7ff]" : "bg-white/20"}`}
                />
              ))}
            </div>
            <p className="mt-5 tabular-nums text-sm text-white/50">
              <ElapsedSeconds since={status?.inFlightReplay?.requestedAt} />s elapsed
            </p>
            <p className="mt-2 text-sm text-white/50">
              It will play on the TV first, then we’ll send the email.
            </p>
          </div>
        ) : null}

        {viewState === "success" ? (
          <div className="max-w-lg text-center">
            <p className="text-3xl font-semibold text-[#00b7ff]">
              Clip saved
            </p>
            <p className="mt-4 text-lg text-white/70">
              Playing on the TV. Check your email and app library.
            </p>
          </div>
        ) : null}

        {viewState === "error" && notice ? (
          <div className="max-w-lg text-center" role="status" aria-live="polite">
            <p className="text-3xl font-semibold tracking-tight">{notice.title}</p>
            <p className="mt-4 text-lg text-white/70">{notice.detail}</p>
            <button
              type="button"
              onClick={closeNotice}
              className={
                notice.action === "retry"
                  ? "mt-8 h-14 rounded-2xl bg-[#00b7ff] px-8 text-lg font-semibold text-[#041019] transition active:scale-[0.98]"
                  : "mt-8 h-14 rounded-2xl border border-white/20 px-8 text-lg text-white/85 transition active:scale-[0.98] active:bg-white/5"
              }
            >
              OK
            </button>
          </div>
        ) : null}
        </div>
      </main>
    </div>
  )
}

/**
 * Seconds since the replay was requested. Mounted only while a capture is in
 * flight, so it starts from zero each time without resetting state.
 */
function ElapsedSeconds({ since }: { since: string | undefined }) {
  const now = useNow(1_000)
  const [mountedAt] = useState(() => Date.now())
  const startedAt = since ? new Date(since).getTime() : mountedAt
  return <>{Math.max(0, Math.floor((now - startedAt) / 1000))}</>
}
