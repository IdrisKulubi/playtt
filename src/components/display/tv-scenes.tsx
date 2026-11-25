"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"

import { ThemeBackground } from "@/components/display/themes/theme-background"
import type { DisplayBooking } from "@/components/display/use-live-score"
import { defaultTheme, type DisplayTheme } from "@/lib/display-themes"

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

/** h:mm:ss (or m:ss under an hour) for a live countdown. */
function formatClockCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const ss = String(seconds).padStart(2, "0")
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}` : `${minutes}:${ss}`
}

/** Text colours for a theme, as CSS variables every scene element reads. */
function inkVars(theme: DisplayTheme): CSSProperties {
  const light = theme.ink === "light"
  return {
    "--tv-ink": light ? "#ffffff" : "#041019",
    "--tv-ink-soft": light ? "rgb(255 255 255 / 0.8)" : "rgb(4 16 25 / 0.72)",
    "--tv-ink-faint": light ? "rgb(255 255 255 / 0.68)" : "rgb(4 16 25 / 0.55)",
    "--tv-track": light ? "rgb(255 255 255 / 0.32)" : "rgb(4 16 25 / 0.16)",
    "--tv-fill": light ? "#ffffff" : theme.palette.deep,
    "--tv-accent": light ? "#ffffff" : theme.palette.deep,
    color: "var(--tv-ink)",
    backgroundColor: theme.palette.base,
  } as CSSProperties
}

/** Full-screen scene on the venue's theme. Free tables move slower. */
function ThemedScene({
  theme,
  speed,
  children,
}: {
  theme: DisplayTheme
  speed: number
  children: ReactNode
}) {
  return (
    <div className="relative h-screen w-screen overflow-hidden" style={inkVars(theme)}>
      <ThemeBackground theme={theme} speed={speed} />
      {children}
    </div>
  )
}

/** Splits a word into letters that rise in one after another. */
function RisingWord({ text }: { text: string }) {
  return (
    <span className="inline-flex overflow-hidden pb-[0.08em]" aria-label={text}>
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

function Label({ children, live = false }: { children: string; live?: boolean }) {
  return (
    <p className="tv-rise flex items-center gap-[1vh] font-mono text-[1.7vh] tracking-[0.28em] uppercase" style={{ color: "var(--tv-ink-soft)" }}>
      <span
        className={`inline-block size-[1.1vh] rounded-full ${live ? "tv-pulse" : ""}`}
        style={{ backgroundColor: "var(--tv-fill)" }}
        aria-hidden
      />
      {children}
    </p>
  )
}

function BarCell({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div className="tv-rise min-w-0" style={{ animationDelay: `${delay}ms` }}>
      <p className="font-mono text-[1.3vh] tracking-[0.26em] uppercase" style={{ color: "var(--tv-ink-faint)" }}>
        {label}
      </p>
      <p className="mt-[0.6vh] truncate text-[2.5vh] font-medium tabular-nums">{value}</p>
    </div>
  )
}

/** Info bar: optional progress line, the facts, and brand + date for photos. */
function InfoBar({
  now,
  venue,
  progress,
  cells,
}: {
  now: number
  venue: string
  progress: number | null
  cells: { label: string; value: string }[]
}) {
  const pct = progress === null ? 0 : Math.min(100, Math.max(0, progress * 100))
  return (
    <div className="absolute inset-x-0 bottom-0 px-[4vw] pb-[3.6vh]">
      {progress !== null ? (
        <div className="relative h-[0.25vh] w-full rounded-full" style={{ backgroundColor: "var(--tv-track)" }}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: "var(--tv-fill)" }} />
        </div>
      ) : null}
      <div className="mt-[2.6vh] grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-end gap-[3vw]">
        {cells.map((cell, index) => (
          <BarCell key={cell.label} label={cell.label} value={cell.value} delay={500 + index * 90} />
        ))}
        <div className="tv-rise text-right" style={{ animationDelay: "800ms" }}>
          <div className="flex items-center justify-end gap-[0.8vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/playtt-mark.svg" alt="" className="h-[2.8vh] w-auto" />
            <span className="text-[1.7vh] font-bold tracking-[0.34em]">PLAYTT</span>
          </div>
          <p className="mt-[0.6vh] font-mono text-[1.3vh] tracking-[0.2em] uppercase" style={{ color: "var(--tv-ink-faint)" }}>
            {venue} · {dateFormatter.format(new Date(now))}
          </p>
        </div>
      </div>
    </div>
  )
}

function Corner({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="tv-rise absolute top-[7vh] right-[4vw] text-right" style={{ animationDelay: "700ms" }}>
      <p className="font-mono text-[1.5vh] tracking-[0.28em] uppercase" style={{ color: "var(--tv-ink-faint)" }}>
        {label}
      </p>
      <p
        className="mt-[0.8vh] font-mono text-[8vh] leading-none font-medium tracking-[-0.03em] tabular-nums"
        style={accent ? { color: "var(--tv-accent)" } : undefined}
        aria-live="polite"
      >
        {value}
      </p>
    </div>
  )
}

export function TvIdleScene({
  tableName,
  venue,
  next,
  theme = defaultTheme(),
}: {
  tableName: string
  venue: string
  next: DisplayBooking | null
  theme?: DisplayTheme
}) {
  const now = useNow()

  return (
    <ThemedScene theme={theme} speed={0.6}>
      <div className="absolute top-[7vh] left-[4vw] max-w-[62vw]">
        <Label>Table free</Label>
        <h1 className="mt-[1.4vh] text-[13vh] leading-[0.9] font-bold tracking-[-0.045em]">
          <RisingWord text={tableName} />
        </h1>
        <p className="tv-rise mt-[2vh] text-[2.8vh]" style={{ color: "var(--tv-ink-soft)", animationDelay: "600ms" }}>
          {next
            ? `Free until ${t(next.startsAt)}. Book in the PlayTT app.`
            : "Free for the rest of the day. Book in the PlayTT app."}
        </p>
      </div>

      <Corner label="Now" value={clockFormatter.format(new Date(now))} />

      <InfoBar
        now={now}
        venue={venue}
        progress={null}
        cells={[
          { label: "Table", value: tableName },
          { label: "Next game", value: next ? `${t(next.startsAt)} – ${t(next.endsAt)}` : "None today" },
          { label: "Book", value: "PlayTT app" },
        ]}
      />
    </ThemedScene>
  )
}

export function TvUpNextScene({
  tableName,
  venue,
  booking,
  theme = defaultTheme(),
}: {
  tableName: string
  venue: string
  booking: DisplayBooking
  theme?: DisplayTheme
}) {
  const now = useNow()
  const msToStart = new Date(booking.startsAt).getTime() - now

  return (
    <ThemedScene theme={theme} speed={0.85}>
      <div className="absolute top-[7vh] left-[4vw] max-w-[60vw]">
        <Label live>{`Up next · ${tableName}`}</Label>
        <h1 className="mt-[1.4vh] text-[17vh] leading-[0.86] font-bold tracking-[-0.05em]">
          <RisingWord text={booking.firstName} />
        </h1>
        <p className="tv-rise mt-[1.8vh] text-[2.8vh]" style={{ color: "var(--tv-ink-soft)", animationDelay: "600ms" }}>
          Your table is getting ready.
        </p>
      </div>

      <Corner label="Starts in" value={formatClockCountdown(msToStart)} accent />

      <InfoBar
        now={now}
        venue={venue}
        progress={1 - msToStart / (5 * 60_000)}
        cells={[
          { label: "Table", value: tableName },
          { label: "Starts", value: `${t(booking.startsAt)} – ${t(booking.endsAt)}` },
          { label: "Players", value: String(booking.groupSize) },
        ]}
      />
    </ThemedScene>
  )
}

export function TvSessionScene({
  tableName,
  venue,
  booking,
  theme = defaultTheme(),
}: {
  tableName: string
  venue: string
  booking: DisplayBooking
  theme?: DisplayTheme
}) {
  const now = useNow()
  const startMs = new Date(booking.startsAt).getTime()
  const endMs = new Date(booking.endsAt).getTime()
  const msLeft = endMs - now
  const lastMinutes = msLeft <= 5 * 60_000

  return (
    <ThemedScene theme={theme} speed={1}>
      <div className="absolute top-[7vh] left-[4vw] max-w-[62vw]">
        <Label live>Now playing</Label>
        <h1 className="mt-[1.4vh] text-[19vh] leading-[0.86] font-bold tracking-[-0.05em]">
          <RisingWord text={booking.firstName} />
        </h1>
        <p className="tv-rise mt-[1.8vh] text-[2.8vh]" style={{ color: "var(--tv-ink-soft)", animationDelay: "600ms" }}>
          {booking.groupSize > 2 ? `and ${booking.groupSize - 1} friends` : "and a friend"} on {tableName}
        </p>
      </div>

      <Corner label={lastMinutes ? "Last points" : "Time left"} value={formatClockCountdown(msLeft)} accent={lastMinutes} />

      <InfoBar
        now={now}
        venue={venue}
        progress={(now - startMs) / Math.max(1, endMs - startMs)}
        cells={[
          { label: "Table", value: tableName },
          { label: "Session", value: `${t(booking.startsAt)} – ${t(booking.endsAt)}` },
          { label: "Players", value: String(booking.groupSize) },
        ]}
      />
    </ThemedScene>
  )
}
