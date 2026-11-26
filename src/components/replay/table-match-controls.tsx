"use client"

import { useState, type ReactNode } from "react"

import {
  hasMatch,
  MATCH_BEST_OF,
  MATCH_NAME_MAX,
  matchWinnerOf,
  playersPerSide,
} from "@/server/scoring/match-setup"
import type { MatchMode, MatchSetup, ScoreState } from "@/server/scoring/types"

type MatchDraft = {
  mode: MatchMode
  sideA: string[]
  sideB: string[]
  bestOf: (typeof MATCH_BEST_OF)[number]
}

const EMPTY_DRAFT: MatchDraft = { mode: "singles", sideA: ["", ""], sideB: ["", ""], bestOf: 5 }

function draftFrom(setup: MatchSetup | null | undefined): MatchDraft {
  if (!setup) return EMPTY_DRAFT
  return {
    mode: setup.mode,
    sideA: [setup.sides.a[0] ?? "", setup.sides.a[1] ?? ""],
    sideB: [setup.sides.b[0] ?? "", setup.sides.b[1] ?? ""],
    bestOf: setup.bestOf,
  }
}

function namesFor(draft: MatchDraft, side: "sideA" | "sideB") {
  return draft[side].slice(0, playersPerSide(draft.mode)).map((name) => name.trim())
}

function sideLabel(state: ScoreState, side: "a" | "b") {
  const names = state.setup?.sides[side]
  if (names?.length) return names.join(" & ")
  return side === "a" ? "Left" : "Right"
}

/**
 * Match setup on the table tablet. Before a match: "Start a match". During a
 * match: the replay button (passed in) is the hero, with the score and a way
 * to end the match. The TV follows whatever this sets.
 */
export function TableMatchControls({
  resourceId,
  state,
  onChanged,
  replayButton,
  replayNote,
}: {
  resourceId: string
  state: ScoreState | null
  onChanged: () => void
  /** Hero size during a match; a quieter one before, so "Start a match" leads. */
  replayButton: (size: "hero" | "compact") => ReactNode
  replayNote: ReactNode
}) {
  const [draft, setDraft] = useState<MatchDraft | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const matchOn = hasMatch(state)
  const winner = state ? matchWinnerOf(state) : null

  async function send(method: "POST" | "DELETE", body?: unknown) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/display/v1/resources/${encodeURIComponent(resourceId)}/match`,
        {
          method,
          headers: body ? { "content-type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        },
      )
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        setError(payload?.message ?? "That didn't work. Try again.")
        return false
      }
      onChanged()
      return true
    } catch {
      setError("Network error. Check the connection and try again.")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function startMatch(next: MatchDraft) {
    const ok = await send("POST", {
      mode: next.mode,
      sideA: namesFor(next, "sideA"),
      sideB: namesFor(next, "sideB"),
      bestOf: next.bestOf,
    })
    if (ok) setDraft(null)
  }

  async function endMatch() {
    const ok = await send("DELETE")
    if (ok) setConfirmEnd(false)
  }

  if (draft) {
    const ready =
      namesFor(draft, "sideA").every(Boolean) && namesFor(draft, "sideB").every(Boolean)

    return (
      <form
        className="flex w-full max-w-2xl flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault()
          if (ready && !busy) void startMatch(draft)
        }}
      >
        <h2 className="text-3xl font-semibold tracking-tight">New match</h2>

        <Segmented
          label="Format"
          value={draft.mode}
          options={[
            { value: "singles", label: "Singles" },
            { value: "doubles", label: "Doubles" },
          ]}
          onChange={(mode) => setDraft({ ...draft, mode })}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          {(["sideA", "sideB"] as const).map((side) => (
            <fieldset key={side} className="flex flex-col gap-3">
              <legend className="mb-3 text-sm text-white/55">
                {side === "sideA" ? "Left side of the TV" : "Right side of the TV"}
              </legend>
              {Array.from({ length: playersPerSide(draft.mode) }, (_, index) => (
                <input
                  key={index}
                  value={draft[side][index]}
                  maxLength={MATCH_NAME_MAX}
                  autoComplete="off"
                  autoCapitalize="words"
                  placeholder={draft.mode === "doubles" ? `Player ${index + 1}` : "Name"}
                  aria-label={`${side === "sideA" ? "Left" : "Right"} side, player ${index + 1}`}
                  onChange={(event) => {
                    const names = [...draft[side]]
                    names[index] = event.target.value
                    setDraft({ ...draft, [side]: names })
                  }}
                  className="h-16 rounded-2xl border border-white/15 bg-white/[0.04] px-5 text-xl text-white placeholder:text-white/30 focus:border-white/50 focus:outline-none"
                />
              ))}
            </fieldset>
          ))}
        </div>

        <Segmented
          label="Length"
          value={String(draft.bestOf)}
          options={MATCH_BEST_OF.map((n) => ({ value: String(n), label: `Best of ${n}` }))}
          onChange={(value) => setDraft({ ...draft, bestOf: Number(value) as MatchDraft["bestOf"] })}
        />

        {error ? <p className="text-lg text-white/80">{error}</p> : null}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => {
              setDraft(null)
              setError(null)
            }}
            className="h-16 flex-1 rounded-2xl border border-white/20 text-xl text-white/80 transition active:scale-[0.98] active:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!ready || busy}
            className="h-16 flex-[2] rounded-2xl bg-white text-xl font-semibold text-black transition active:scale-[0.98] disabled:opacity-30"
          >
            {busy ? "Starting…" : "OK, start match"}
          </button>
        </div>
      </form>
    )
  }

  if (!matchOn || !state) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-6">
        <div className="w-full max-w-md">{replayButton("hero")}</div>
        {replayNote}
        <button
          type="button"
          onClick={() => setDraft(EMPTY_DRAFT)}
          className="flex h-20 w-full max-w-md flex-col items-center justify-center rounded-3xl border border-white/20 text-white transition active:scale-[0.98] active:bg-white/5"
        >
          <span className="text-2xl font-semibold tracking-tight">Start a match</span>
          <span className="text-sm text-white/55">Names on the TV, scored by the buttons</span>
        </button>
      </div>
    )
  }

  if (winner) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-6 text-center">
        <p className="text-sm tracking-[0.2em] text-white/50 uppercase">Match won</p>
        <p className="text-4xl font-semibold tracking-tight">
          {sideLabel(state, winner)} {Math.max(state.gamesA, state.gamesB)}–{Math.min(state.gamesA, state.gamesB)}
        </p>
        <div className="flex w-full max-w-md gap-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void startMatch(draftFrom(state.setup))}
            className={`h-16 flex-1 rounded-2xl bg-white text-xl font-semibold text-black transition active:scale-[0.98] disabled:opacity-40 ${state.setup ? "" : "hidden"}`}
          >
            Rematch
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setDraft(draftFrom(state.setup))}
            className="h-16 flex-1 rounded-2xl border border-white/20 text-xl text-white/85 transition active:scale-[0.98] active:bg-white/5"
          >
            New match
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void endMatch()}
          className="text-base text-white/50 underline-offset-4 hover:underline"
        >
          Done playing
        </button>
        {error ? <p className="text-lg text-white/80">{error}</p> : null}
        <div className="w-full max-w-md">{replayButton("compact")}</div>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-8">
      <ScoreSummary state={state} />
      <div className="w-full max-w-md">{replayButton("hero")}</div>
      {replayNote}

      {confirmEnd ? (
        <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-white/15 p-6 text-center">
          <p className="text-xl">End this match? The score is cleared from the TV.</p>
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => setConfirmEnd(false)}
              className="h-14 flex-1 rounded-2xl border border-white/20 text-lg text-white/85 active:bg-white/5"
            >
              Keep playing
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void endMatch()}
              className="h-14 flex-1 rounded-2xl bg-white text-lg font-semibold text-black disabled:opacity-40"
            >
              {busy ? "Ending…" : "End match"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmEnd(true)}
          className="text-base text-white/50 underline-offset-4 hover:underline"
        >
          End or cancel match
        </button>
      )}
      {error ? <p className="text-lg text-white/80">{error}</p> : null}
    </div>
  )
}

function ScoreSummary({ state }: { state: ScoreState }) {
  const bestOf = state.setup?.bestOf ?? state.gamesToWin * 2 - 1
  return (
    <div className="w-full max-w-md text-center">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <SummarySide name={sideLabel(state, "a")} points={state.pointsA} games={state.gamesA} align="right" />
        <span className="h-12 w-px bg-white/20" aria-hidden />
        <SummarySide name={sideLabel(state, "b")} points={state.pointsB} games={state.gamesB} align="left" />
      </div>
      <p className="mt-3 text-sm tracking-[0.18em] text-white/45 uppercase">Best of {bestOf}</p>
    </div>
  )
}

function SummarySide({
  name,
  points,
  games,
  align,
}: {
  name: string
  points: number
  games: number
  align: "left" | "right"
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="truncate text-base text-white/65">{name}</p>
      <p className="text-5xl font-bold tabular-nums">{points}</p>
      <p className="text-sm text-white/45 tabular-nums">Games {games}</p>
    </div>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-2xl border border-white/15 p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`h-14 flex-1 rounded-xl text-lg transition ${selected ? "bg-white font-semibold text-black" : "text-white/70 active:bg-white/5"}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
