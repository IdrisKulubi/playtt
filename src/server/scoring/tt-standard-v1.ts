import type {
  ScoreEventInput,
  ScoreSide,
  ScoreState,
  SportRulesAdapter,
  SportRulesConfig,
} from "@/server/scoring/types"
import {
  SportRulesError,
  ttStandardV1Adapter as coreAdapter,
} from "./tt-standard-v1-core.mjs"

export { SportRulesError }

export const ttStandardV1Adapter: SportRulesAdapter = {
  ruleset: coreAdapter.ruleset,
  validateConfig(config: SportRulesConfig) {
    coreAdapter.validateConfig(config)
  },
  initialState(config: SportRulesConfig): ScoreState {
    return coreAdapter.initialState(config) as ScoreState
  },
  applyEvent(state: ScoreState, event: ScoreEventInput): ScoreState {
    return coreAdapter.applyEvent(state, event) as ScoreState
  },
}
