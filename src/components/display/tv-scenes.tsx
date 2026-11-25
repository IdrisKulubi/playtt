"use client"

import { useEffect, useRef, useState } from "react"

import {
  drawIdle,
  drawRally,
  drawWarmup,
} from "@/components/display/tv-canvas"
import type { DisplayBooking } from "@/components/display/use-live-score"

const timeFormatter = new Intl.DateTimeFormat("en-KE", {
  hour: "numeric",
  minute: "2-digit",
})

const dateFormatter = new Intl.DateTimeFormat("en-KE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
})

const clockFormatter = new Intl.DateTimeFormat("en-KE", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const t = (iso: string) => timeFormatter.format(new Date(iso))

/** Re-renders once a second: countdowns, clock and scene changes. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function formatMinutesLeft(ms: number) {
  const minutes = Math.max(0, Math.ceil(ms / 60_000))
  if (minutes < 60) return `${minutes} min left`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h left` : `${hours}h ${rest}m left`
}

/**
 * Full-screen canvas driven by one animation-frame loop. `draw` gets the
 * seconds since mount; with reduced motion the scene holds a still frame.
 */
function SceneCanvas({
  draw,
}: {
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef(draw)

  useEffect(() => {
    drawRef.current = draw
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const start = performance.now()
    let frame = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    const loop = (nowMs: number) => {
      const seconds = reduced ? 4.2 : (nowMs - start) / 1000
      drawRef.current(ctx, canvas.clientWidth, canvas.clientHeight, seconds)
      if (!reduced) frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
}

function useMarkImage() {
  const [mark, setMark] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    const image = new Image()
    image.src = "/brand/playtt-mark.svg"
    image.onload = () => setMark(image)
  }, [])
  return mark
}

/** Bottom strip on every scene: brand, date and clock, so a photo tells the story. */
function ShareStrip({ now, venue }: { now: number; venue: string }) {
  return (
    <footer className="tv-rise absolute inset-x-0 bottom-0 flex items-end justify-between px-[4vw] pb-[3.2vh] text-white/55">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/playtt-mark.svg" alt="" className="h-[3.2vh] w-auto" />
        <span className="text-[1.6vh] font-semibold tracking-[0.32em] text-white/80">
          PLAYTT
        </span>
        <span className="hidden text-[1.5vh] sm:inline">Book a pod. Play on.</span>
      </div>
      <div className="text-right font-mono text-[1.5vh] tracking-[0.12em] uppercase tabular-nums">
        {venue} · {dateFormatter.format(new Date(now))}
      </div>
    </footer>
  )
}

function Clock({ now }: { now: number }) {
  return (
    <div className="absolute top-[3.2vh] right-[4vw] font-mono text-[2.4vh] tabular-nums text-white/60">
      {clockFormatter.format(new Date(now))}
    </div>
  )
}

/** Splits a word into letters that rise in one after another. */
function RisingWord({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex overflow-hidden pb-[0.08em] ${className ?? ""}`} aria-label={text}>
      {Array.from(text).map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          aria-hidden
          className="tv-letter inline-block"
          style={{ animationDelay: `${120 + index * 55}ms` }}
        >
          {letter === " " ? " " : letter}
        </span>
      ))}
    </span>
  )
}

export function TvIdleScene({
  tableName,
  venue,
  next,
}: {
  tableName: string
  venue: string
  next: DisplayBooking | null
}) {
  const now = useNow()
  const mark = useMarkImage()
  const [corner, setCorner] = useState(false)
  const cornerRef = useRef(false)

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07111d] text-white">
      <SceneCanvas
        draw={(ctx, w, h, seconds) => {
          const { cornerAge } = drawIdle(ctx, w, h, seconds, mark)
          const showCorner = cornerAge < 2.5
          if (showCorner !== cornerRef.current) {
            cornerRef.current = showCorner
            setCorner(showCorner)
          }
        }}
      />
      <Clock now={now} />

      <div className="absolute bottom-[14vh] left-[4vw] max-w-[70vw]">
        <p className="tv-rise text-[2vh] font-semibold tracking-[0.32em] text-[#00b7ff] uppercase">
          Table free
        </p>
        <h1 className="mt-[1.6vh] text-[9vh] leading-[0.95] font-bold tracking-tight">
          <RisingWord text={tableName} />
          <br />
          <span className="text-white/45">
            <RisingWord text="is free." />
          </span>
        </h1>
        <p className="tv-rise mt-[2.4vh] text-[2.6vh] text-white/70" style={{ animationDelay: "700ms" }}>
          {next
            ? `Free until ${t(next.startsAt)}. Book in the PlayTT app.`
            : "Free for the rest of the day. Book in the PlayTT app."}
        </p>
      </div>

      {corner ? (
        <div className="tv-pop absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[5vh] font-bold tracking-tight text-[#00b7ff]">
          Corner.
        </div>
      ) : null}

      <ShareStrip now={now} venue={venue} />
    </div>
  )
}

export function TvUpNextScene({
  tableName,
  venue,
  booking,
}: {
  tableName: string
  venue: string
  booking: DisplayBooking
}) {
  const now = useNow()
  const msToStart = new Date(booking.startsAt).getTime() - now

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07111d] text-white">
      <SceneCanvas draw={(ctx, w, h, seconds) => drawWarmup(ctx, w, h, seconds)} />
      <Clock now={now} />

      <div className="absolute top-1/2 left-[4vw] max-w-[62vw] -translate-y-1/2">
        <p className="tv-rise text-[2vh] font-semibold tracking-[0.32em] text-[#00b7ff] uppercase">
          Up next on {tableName}
        </p>
        <h1 className="mt-[1.6vh] text-[16vh] leading-[0.9] font-bold tracking-tight">
          <RisingWord text={booking.firstName} />
        </h1>
        <p className="tv-rise mt-[2.4vh] text-[2.8vh] text-white/70" style={{ animationDelay: "600ms" }}>
          Your table is ready at {t(booking.startsAt)}. Grab a paddle.
        </p>
        <p
          className="tv-rise mt-[4vh] font-mono text-[12vh] leading-none font-semibold tabular-nums text-[#00b7ff]"
          style={{ animationDelay: "800ms" }}
          aria-live="polite"
        >
          {formatCountdown(msToStart)}
        </p>
      </div>

      <ShareStrip now={now} venue={venue} />
    </div>
  )
}

export function TvSessionScene({
  tableName,
  venue,
  booking,
}: {
  tableName: string
  venue: string
  booking: DisplayBooking
}) {
  const now = useNow()
  const startMs = new Date(booking.startsAt).getTime()
  const endMs = new Date(booking.endsAt).getTime()
  const msLeft = endMs - now

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07111d] text-white">
      <SceneCanvas
        draw={(ctx, w, h, seconds) =>
          drawRally(ctx, w, h, seconds, (Date.now() - startMs) / Math.max(1, endMs - startMs))
        }
      />
      <Clock now={now} />

      <div className="absolute top-[9vh] left-[4vw] max-w-[88vw]">
        <p className="tv-rise text-[2vh] font-semibold tracking-[0.32em] text-[#00b7ff] uppercase">
          Now playing · {tableName}
        </p>
        <h1 className="mt-[1.2vh] text-[22vh] leading-[0.86] font-bold tracking-[-0.04em]">
          <RisingWord text={booking.firstName} />
          <span className="tv-rise text-[#00b7ff]" style={{ animationDelay: "900ms" }}>
            .
          </span>
        </h1>
        <p
          className="tv-rise mt-[2.4vh] text-[3vh] text-white/75"
          style={{ animationDelay: "700ms" }}
        >
          {t(booking.startsAt)} – {t(booking.endsAt)} · {booking.groupSize} players
        </p>
      </div>

      <div
        className="tv-rise absolute top-[9vh] right-[4vw] mt-[5vh] text-right"
        style={{ animationDelay: "900ms" }}
      >
        <p className={`font-mono text-[4.4vh] font-semibold tabular-nums ${msLeft <= 5 * 60_000 ? "text-[#ffb800]" : "text-white"}`}>
          {formatMinutesLeft(msLeft)}
        </p>
        <p className="mt-[0.6vh] text-[1.8vh] tracking-[0.2em] text-white/50 uppercase">
          {msLeft <= 5 * 60_000 ? "Last points" : "On the clock"}
        </p>
      </div>

      <ShareStrip now={now} venue={venue} />
    </div>
  )
}
