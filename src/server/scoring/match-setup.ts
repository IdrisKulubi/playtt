// Pure match-setup rules for the table tablet. No "@/" imports so node --test
// can load this file directly (see match-setup.test.mjs).

import type { MatchMode, MatchSetup, ScoreState } from "./types.ts"

export const MATCH_BEST_OF = [3, 5, 7] as const
export const MATCH_NAME_MAX = 20

export class MatchSetupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MatchSetupError"
  }
}

export interface MatchSetupInput {
  mode?: unknown
  sideA?: unknown
  sideB?: unknown
  bestOf?: unknown
}

function cleanNames(raw: unknown, count: number, label: string) {
  if (!Array.isArray(raw)) {
    throw new MatchSetupError(`${label} needs ${count === 1 ? "a name" : "two names"}.`)
  }

  const names = raw
    .map((value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""))
    .filter((value) => value.length > 0)

  if (names.length !== count) {
    throw new MatchSetupError(`${label} needs ${count === 1 ? "a name" : "two names"}.`)
  }

  return names.map((name) => name.slice(0, MATCH_NAME_MAX))
}

/** Validates the tablet form and returns a normalised setup. */
export function parseMatchSetup(input: MatchSetupInput, now: Date = new Date()): MatchSetup {
  const mode = input.mode
  if (mode !== "singles" && mode !== "doubles") {
    throw new MatchSetupError("Choose singles or doubles.")
  }

  const bestOf = Number(input.bestOf)
  if (!(MATCH_BEST_OF as readonly number[]).includes(bestOf)) {
    throw new MatchSetupError("Choose best of 3, 5 or 7.")
  }

  const perSide = playersPerSide(mode)

  return {
    mode,
    sides: {
      a: cleanNames(input.sideA, perSide, "The left side"),
      b: cleanNames(input.sideB, perSide, "The right side"),
    },
    bestOf: bestOf as MatchSetup["bestOf"],
    startedAt: now.toISOString(),
  }
}

export function playersPerSide(mode: MatchMode) {
  return mode === "doubles" ? 2 : 1
}

export function gamesToWinForBestOf(bestOf: number) {
  return Math.floor(bestOf / 2) + 1
}

/** A fresh state for a match the tablet just started. */
export function stateForStartedMatch(initial: ScoreState, setup: MatchSetup): ScoreState {
  return {
    ...initial,
    gamesToWin: gamesToWinForBestOf(setup.bestOf),
    setup,
  }
}

/** A fresh state with no match on the table: the TV goes back to the session scene. */
export function stateForEndedMatch(initial: ScoreState): ScoreState {
  return { ...initial, setup: null }
}

/** True while a match is set up or being scored, including a just-finished one. */
export function hasMatch(state: ScoreState | null | undefined) {
  if (!state) return false
  return Boolean(
    state.setup ||
      state.matchStatus !== "not_started" ||
      state.pointsA + state.pointsB + state.gamesA + state.gamesB > 0,
  )
}

export type PointCue = "match" | "game" | null

/** "Game point" / "Match point" for a side, from the tt standard rules. */
export function pointCueFor(state: ScoreState, side: "a" | "b"): PointCue {
  if (state.matchStatus === "completed") return null
  const own = side === "a" ? state.pointsA : state.pointsB
  const other = side === "a" ? state.pointsB : state.pointsA
  const wouldWinGame = own + 1 >= state.pointsToWin && own + 1 - other >= state.winBy
  if (!wouldWinGame) return null
  const games = side === "a" ? state.gamesA : state.gamesB
  return games + 1 >= state.gamesToWin ? "match" : "game"
}

export function matchWinnerOf(state: ScoreState): "a" | "b" | null {
  if (state.matchStatus !== "completed") return null
  if (state.gamesA >= state.gamesToWin) return "a"
  if (state.gamesB >= state.gamesToWin) return "b"
  return null
}
