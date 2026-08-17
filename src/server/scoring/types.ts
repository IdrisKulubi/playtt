import { TT_STANDARD_RULESET } from "@/server/catalog/constants"

export type ScoreSide = "a" | "b"
export type ScoreEventKind = "point" | "correction"
export type MatchStatus = "not_started" | "in_progress" | "completed"

export interface ScoreState {
  ruleset: string
  matchStatus: MatchStatus
  gamesA: number
  gamesB: number
  pointsA: number
  pointsB: number
  initialServer: ScoreSide
  server: ScoreSide
  gamesToWin: number
  pointsToWin: number
  winBy: number
}

export interface ScoreEventInput {
  kind: ScoreEventKind
  side: ScoreSide
  delta: number
}

export interface SportRulesConfig {
  ruleset: string
  gamesToWin?: number
  pointsToWin?: number
  winBy?: number
  initialServer?: ScoreSide
}

export interface SportRulesAdapter {
  ruleset: string
  validateConfig(config: SportRulesConfig): void
  initialState(config: SportRulesConfig): ScoreState
  applyEvent(state: ScoreState, event: ScoreEventInput): ScoreState
}

export class SportRulesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SportRulesError"
  }
}

export function resolveRulesetFromSnapshot(
  configurationSnapshot: Record<string, unknown>,
): string {
  const resource = configurationSnapshot.resource as
    | { ruleset?: string | null }
    | null
    | undefined

  return resource?.ruleset ?? TT_STANDARD_RULESET
}
