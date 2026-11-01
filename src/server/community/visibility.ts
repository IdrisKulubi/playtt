import type { CommunityRequestPolicy } from "./constants.ts"

export type RelationshipFacts = {
  viewerId: string
  targetId: string
  targetCommunityVisible: boolean
  targetRequestPolicy: CommunityRequestPolicy
  viewerBlockedTarget: boolean
  targetBlockedViewer: boolean
  viewerFollowsTarget: boolean
  targetFollowsViewer: boolean
  /** Both played the same community booking (M4). */
  playedTogether?: boolean
}

// Rally Partners: a mutual follow, or at least one shared community booking.
export function isRallyPartner(
  facts: Pick<RelationshipFacts, "viewerFollowsTarget" | "targetFollowsViewer" | "playedTogether">,
) {
  return (facts.viewerFollowsTarget && facts.targetFollowsViewer) || Boolean(facts.playedTogether)
}

// Blocks apply in both directions; a hidden profile is only visible to its owner.
export function canSee(facts: RelationshipFacts) {
  if (facts.viewerId === facts.targetId) {
    return true
  }

  if (facts.viewerBlockedTarget || facts.targetBlockedViewer) {
    return false
  }

  return facts.targetCommunityVisible
}

// `requestPolicy` is the target's setting for who may start a chat with them.
export function canMessage(facts: RelationshipFacts) {
  if (facts.viewerId === facts.targetId || !canSee(facts)) {
    return false
  }

  switch (facts.targetRequestPolicy) {
    case "everyone":
      return true
    case "followers":
      return facts.viewerFollowsTarget
    case "rally_partners":
      return isRallyPartner(facts)
  }
}
