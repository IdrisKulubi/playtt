"use client"

import {
  clockFormatter,
  RisingWord,
  ThemedScene,
  useNow,
} from "@/components/display/tv-scenes"
import type { DisplayTheme } from "@/lib/display-themes"
import { matchWinnerOf, pointCueFor } from "@/server/scoring/match-setup"
import type { ScoreSide, ScoreState } from "@/server/scoring/types"

/**
 * The venue TV while a match is scored on the ESP32 buttons. Side A is the
 * left half of the screen, side B the right.
 */
export function TvScoreboardScene({
  tableName,
  state,
  theme,
}: {
  tableName: string
  state: ScoreState
  theme: DisplayTheme
}) {
  const now = useNow()
  const winner = matchWinnerOf(state)
  const bestOf = state.setup?.bestOf ?? state.gamesToWin * 2 - 1

  return (
    <ThemedScene theme={theme} speed={0.5} composition="centre">
      {/* Top bar: table · brand · time */}
      <header className="tv-rise absolute inset-x-[4vw] top-[5vh] grid grid-cols-3 items-center">
        <p className="truncate text-[3vh] font-semibold tracking-[-0.01em]">{tableName}</p>
        <div className="flex items-center justify-center gap-[0.9vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/playtt-mark.svg" alt="" className="h-[3vh] w-auto" />
          <span className="text-[1.9vh] font-bold tracking-[0.34em]">PLAYTT</span>
        </div>
        <p className="text-right font-mono text-[3vh] font-medium tabular-nums">
          {clockFormatter.format(new Date(now))}
        </p>
      </header>

      {winner ? (
        <MatchWonCard state={state} winner={winner} />
      ) : (
        <>
          {/* The hairline that splits the table in two. */}
          <div
            aria-hidden
            className="tv-fade absolute top-[16vh] bottom-[16vh] left-1/2 w-px -translate-x-1/2"
            style={{ backgroundColor: "var(--tv-track)" }}
          />
          <div className="absolute inset-x-0 top-[12vh] bottom-[14vh] grid grid-cols-2">
            <ScoreHalf state={state} side="a" />
            <ScoreHalf state={state} side="b" />
          </div>
        </>
      )}

      {/* Players, one per corner, one or two names each. */}
      <Names names={state.setup?.sides.a ?? []} align="left" serving={!winner && state.server === "a"} />
      <Names names={state.setup?.sides.b ?? []} align="right" serving={!winner && state.server === "b"} />

      <p
        className="tv-rise absolute inset-x-0 bottom-[5.4vh] text-center font-mono text-[1.4vh] tracking-[0.28em] uppercase"
        style={{ color: "var(--tv-ink-faint)", animationDelay: "500ms" }}
      >
        {winner
          ? `Best of ${bestOf}`
          : `Best of ${bestOf} · Game ${Math.min(state.gamesA + state.gamesB + 1, bestOf)}`}
      </p>
    </ThemedScene>
  )
}

function ScoreHalf({ state, side }: { state: ScoreState; side: ScoreSide }) {
  const points = side === "a" ? state.pointsA : state.pointsB
  const games = side === "a" ? state.gamesA : state.gamesB
  const cue = pointCueFor(state, side)

  return (
    <section className="flex min-w-0 flex-col items-center justify-center" aria-label={side === "a" ? "Left side" : "Right side"}>
      {/* Fixed height so the score never jumps when the cue appears. */}
      <p
        className="h-[3vh] font-mono text-[2.1vh] tracking-[0.3em] uppercase"
        style={{ color: "var(--tv-ink-soft)" }}
        aria-live="polite"
      >
        {cue ? (
          <span key={cue} className="tv-fade inline-block">
            {cue === "match" ? "Match point" : "Game point"}
          </span>
        ) : null}
      </p>
      <p
        className="leading-[0.86] font-bold tracking-[-0.06em] tabular-nums"
        style={{ fontSize: "min(54vh, 28vw)" }}
        aria-label={`${points} points`}
      >
        {/* Keyed on the value: each new point rolls in. */}
        <span key={`${games}-${points}`} className="tv-score-tick inline-block">
          {points}
        </span>
      </p>
      <div className="mt-[3vh] flex flex-col items-center">
        <p className="font-mono text-[1.4vh] tracking-[0.28em] uppercase" style={{ color: "var(--tv-ink-faint)" }}>
          Games
        </p>
        <p className="mt-[0.6vh] text-[8vh] leading-none font-semibold tabular-nums" style={{ color: "var(--tv-ink-soft)" }}>
          <span key={games} className="tv-score-tick inline-block">
            {games}
          </span>
        </p>
      </div>
    </section>
  )
}

function Names({
  names,
  align,
  serving,
}: {
  names: string[]
  align: "left" | "right"
  serving: boolean
}) {
  if (names.length === 0) return null
  const doubles = names.length > 1

  return (
    <div
      className={`tv-rise absolute bottom-[4.4vh] max-w-[34vw] ${align === "left" ? "left-[4vw] text-left" : "right-[4vw] text-right"}`}
      style={{ animationDelay: "300ms" }}
    >
      <p
        className={`flex h-[2.4vh] items-center gap-[0.8vh] font-mono text-[1.4vh] tracking-[0.28em] uppercase ${align === "right" ? "justify-end" : ""}`}
        style={{ color: "var(--tv-ink-faint)" }}
      >
        {serving ? (
          <>
            <span className="inline-block size-[1vh] rounded-full" style={{ backgroundColor: "var(--tv-fill)" }} aria-hidden />
            Serving
          </>
        ) : null}
      </p>
      {names.map((name) => (
        <p
          key={name}
          className={`truncate font-semibold tracking-[-0.02em] ${doubles ? "text-[3.6vh] leading-[1.15]" : "text-[4.6vh] leading-tight"}`}
        >
          {name}
        </p>
      ))}
    </div>
  )
}

function MatchWonCard({ state, winner }: { state: ScoreState; winner: ScoreSide }) {
  const names = state.setup?.sides[winner] ?? []
  const headline = names.length > 0 ? names.join(" & ") : winner === "a" ? "Left side" : "Right side"
  const size = `min(17vh, ${(84 / (0.55 * Math.max(6, headline.length))).toFixed(2)}vw)`
  const [high, low] = winner === "a" ? [state.gamesA, state.gamesB] : [state.gamesB, state.gamesA]

  return (
    <div className="absolute inset-x-[4vw] top-[46%] flex -translate-y-1/2 flex-col items-center text-center">
      <p className="tv-rise font-mono text-[2vh] tracking-[0.3em] uppercase" style={{ color: "var(--tv-ink-soft)" }}>
        Match won
      </p>
      <h1 className="mt-[2vh] leading-[0.9] font-bold tracking-[-0.05em]" style={{ fontSize: size }}>
        <RisingWord text={headline} />
      </h1>
      <p
        className="tv-rise mt-[4vh] text-[9vh] leading-none font-semibold tracking-[-0.03em] tabular-nums"
        style={{ animationDelay: "700ms" }}
      >
        {high}
        <span className="mx-[2vw]" style={{ color: "var(--tv-ink-faint)" }}>
          –
        </span>
        {low}
      </p>
      <p className="tv-rise mt-[2.4vh] text-[2.6vh]" style={{ color: "var(--tv-ink-soft)", animationDelay: "850ms" }}>
        Start a rematch on the tablet.
      </p>
    </div>
  )
}
