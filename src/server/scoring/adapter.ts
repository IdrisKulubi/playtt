import { TT_STANDARD_RULESET } from "@/server/catalog/constants"
import { SportRulesError, type SportRulesAdapter } from "@/server/scoring/types"
import { ttStandardV1Adapter } from "@/server/scoring/tt-standard-v1"

export type {
  MatchStatus,
  ScoreEventInput,
  ScoreEventKind,
  ScoreSide,
  ScoreState,
  SportRulesAdapter,
  SportRulesConfig,
} from "@/server/scoring/types"
export { SportRulesError, resolveRulesetFromSnapshot } from "@/server/scoring/types"

export function getSportRulesAdapter(ruleset: string): SportRulesAdapter {
  if (ruleset === TT_STANDARD_RULESET) {
    return ttStandardV1Adapter
  }

  throw new SportRulesError(`Unsupported ruleset: ${ruleset}`)
}
