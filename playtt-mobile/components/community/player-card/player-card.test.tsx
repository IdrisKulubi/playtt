import React from "react"
import { render } from "@testing-library/react-native"

import type { CommunityPlayer } from "@/lib/community-types"

import {
  EMPTY_STAT,
  formatNairobiClock,
  formatStat,
  nextTierProgress,
  playerCardAccessibilityLabel,
  sharedUsualTimes,
  tierForPlayer,
  statusRibbon,
} from "./card-tiers"
import { PlayerCard } from "./player-card"

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("react-native-reanimated", () => require("@/test/reanimated-mock"))
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "dark" }))
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
}))
jest.mock("expo-image", () => ({ Image: () => null }))
jest.mock("phosphor-react-native/src/icons/Fire", () => ({ Fire: () => null }))
jest.mock("phosphor-react-native/src/icons/Handshake", () => ({ Handshake: () => null }))
jest.mock("phosphor-react-native/src/icons/Medal", () => ({ Medal: () => null }))
jest.mock("phosphor-react-native/src/icons/Star", () => ({ Star: () => null }))
jest.mock("phosphor-react-native/src/icons/CheckCircle", () => ({ CheckCircle: () => null }))

const NO_STATS = {
  matches: null,
  winRate: null,
  reliability: null,
  streakWeeks: null,
  kudos: null,
  hours: null,
}

function player(overrides: Partial<CommunityPlayer> = {}): CommunityPlayer {
  return {
    id: "user_amara",
    displayName: "Amara K.",
    image: null,
    skillLevel: "intermediate",
    playStyle: "attacker",
    handedness: "right",
    bio: "Loopy forehand",
    usualTimes: ["weekday_evenings"],
    foundingPlayer: false,
    availability: null,
    relationship: {
      following: false,
      followsYou: false,
      rallyPartner: false,
      blockedByYou: false,
      canMessage: true,
    },
    stats: { ...NO_STATS, matches: 42, winRate: 61, hours: 31 },
    badges: [],
    ...overrides,
  }
}

// 21:00 Nairobi = 18:00Z
const OPEN_NOW = {
  window: "now" as const,
  startsAt: "2026-10-28T16:00:00.000Z",
  endsAt: "2026-10-28T18:00:00.000Z",
  note: null,
  lookingForDoubles: false,
  openNow: true,
}

test("the card tier comes from the server, starting at blue", () => {
  expect(tierForPlayer(player({ skillLevel: "pro" }))).toBe("blue")
  expect(tierForPlayer(player({ stats: { ...NO_STATS, tier: "purple" } }))).toBe("purple")
  expect(tierForPlayer(player({ stats: { ...NO_STATS, tier: "gold" } }))).toBe("gold")
})

test("progress shows points to the next tier, and nothing at gold", () => {
  expect(
    nextTierProgress(player({ stats: { ...NO_STATS, tier: "purple", points: 1080, nextTierPoints: 1400 } }), "dark"),
  ).toEqual({ label: "320 pts to Star", fraction: 1080 / 1400 })
  expect(nextTierProgress(player({ stats: { ...NO_STATS, tier: "gold", points: 3000, nextTierPoints: null } }), "dark")).toBeNull()
})

test("missing stats render as a dash, never zero", () => {
  expect(formatStat(null)).toBe(EMPTY_STAT)
  expect(formatStat(0)).toBe("0")
  expect(formatStat(60.6)).toBe("61")
})

test("clock labels use Nairobi time", () => {
  expect(formatNairobiClock("2026-10-28T18:00:00.000Z")).toBe("9PM")
  expect(formatNairobiClock("2026-10-28T06:30:00.000Z")).toBe("9:30AM")
  expect(formatNairobiClock("2026-10-28T21:00:00.000Z")).toBe("12AM")
})

test("status ribbon shows open now with the end time, or the later window", () => {
  expect(statusRibbon(OPEN_NOW)?.label).toBe("OPEN NOW · →9PM")
  expect(statusRibbon({ ...OPEN_NOW, window: "tonight", openNow: false })?.label).toBe("TONIGHT")
  expect(statusRibbon(null)).toBeNull()
})

test("accessibility label reads name, tier, status and headline stats", () => {
  expect(playerCardAccessibilityLabel(player({ availability: OPEN_NOW }))).toBe(
    "Amara K., Rookie tier, open now until 9 PM, 42 matches, 61 percent wins",
  )
  // Stats without data are skipped rather than read out as zero.
  expect(playerCardAccessibilityLabel(player({ skillLevel: "beginner", stats: NO_STATS }))).toBe(
    "Amara K., Rookie tier",
  )
})

describe.each(["beginner", "intermediate", "pro"] as const)("%s card", (skillLevel) => {
  test.each(["full", "compact", "mini"] as const)("renders at %s size", async (size) => {
    const screen = await render(
      <PlayerCard player={player({ skillLevel, availability: OPEN_NOW })} size={size} onPress={() => undefined} />,
    )
    expect(screen.getByText(size === "mini" ? "Amara K." : "AMARA K.")).toBeTruthy()
    expect(screen.getByLabelText(/^Amara K\., (Rookie|Contender|Star|Legend) tier/)).toBeTruthy()
  })
})

test("compact card shows dashes for empty stats and only MAT, WIN%, REL", async () => {
  const screen = await render(<PlayerCard player={player({ stats: NO_STATS })} size="compact" />)
  expect(screen.getAllByText(EMPTY_STAT)).toHaveLength(3)
  expect(screen.queryByText("0")).toBeNull()
  expect(screen.getByText("WIN%")).toBeTruthy()
  expect(screen.queryByText("HRS")).toBeNull()
})

test("full card shows all six stat slots and the rating placeholder", async () => {
  const screen = await render(<PlayerCard player={player()} size="full" />)
  for (const code of ["MAT", "WIN%", "REL", "STK", "KUD", "HRS"]) {
    expect(screen.getByText(code)).toBeTruthy()
  }
  expect(screen.getByText("NEW")).toBeTruthy()
  expect(screen.getByText("42")).toBeTruthy()
})

test("flippable full card renders the back with bio and usual times", async () => {
  const screen = await render(<PlayerCard player={player()} size="full" flippable />)
  expect(screen.getByText("Loopy forehand")).toBeTruthy()
  expect(screen.getByText("Weekday evenings")).toBeTruthy()
  expect(screen.getByLabelText(/Amara K\./).props.accessibilityHint).toBe("Flips the card")
})

test("server badges show on the full card, most important first", async () => {
  const screen = await render(
    <PlayerCard player={player({ badges: ["rally_ace", "reliable"], foundingPlayer: true })} size="full" />,
  )
  expect(screen.getByText("Rally ace")).toBeTruthy()
  expect(screen.getByText("Reliable")).toBeTruthy()
  expect(screen.getByText("Founding player")).toBeTruthy()
})

test("players at the venue get an AT PARKLANDS chip and say so to screen readers", async () => {
  const screen = await render(
    <PlayerCard player={{ ...player(), atVenueName: "PlayTT Parklands" }} size="compact" />,
  )
  expect(screen.getByText("AT PARKLANDS")).toBeTruthy()
  expect(screen.getByLabelText(/at PlayTT Parklands now/)).toBeTruthy()
})

test("the card back lists top kudos", async () => {
  const screen = await render(
    <PlayerCard player={{ ...player(), kudos: [{ type: "great_rallies", count: 7 }] }} size="full" flippable />,
  )
  expect(screen.getByText(/Great rallies · 7/)).toBeTruthy()
})

test("shared usual times keep the other player's order", () => {
  expect(sharedUsualTimes(["sat_mornings", "weekday_evenings"], ["weekday_evenings", "late_night", "sat_mornings"])).toEqual([
    "weekday_evenings",
    "sat_mornings",
  ])
})

test("rated players show their number and server tier", async () => {
  const rated = player({
    skillLevel: "beginner",
    stats: { ...NO_STATS, rating: 84, points: 2600, tier: "gold", nextTierPoints: null, matches: 30 },
  })
  expect(tierForPlayer(rated)).toBe("gold")

  const screen = await render(<PlayerCard player={rated} size="full" />)
  expect(screen.getByText("84")).toBeTruthy()
  expect(screen.getByText("LEGEND")).toBeTruthy()
  expect(screen.getByLabelText(/Legend tier, rated 84/)).toBeTruthy()
})

test("in-form players get the IN FORM tag", async () => {
  const screen = await render(<PlayerCard player={player({ badges: ["in_form"] })} size="full" />)
  expect(screen.getByText("IN FORM")).toBeTruthy()
  expect(screen.getByText("In form")).toBeTruthy()
})

test("doubles ribbon shows how full the 2v2 is", () => {
  const open = { ...OPEN_NOW, lookingForDoubles: true }
  expect(statusRibbon({ ...open, doubles: { members: 1, max: 4 } })?.doublesLabel).toBe("2v2")
  expect(statusRibbon({ ...open, doubles: { members: 3, max: 4 } })?.doublesLabel).toBe("2v2 · 3/4")
  expect(statusRibbon({ ...open, doubles: { members: 4, max: 4 } })?.doublesLabel).toBe("2v2 · full")
})

test("the card back shows head-to-head once you've played", async () => {
  const headToHead = { wins: 2, losses: 3, lastPlayedAt: null, recent: [] }
  const screen = await render(<PlayerCard player={{ ...player(), headToHead }} size="full" flippable />)
  expect(screen.getByText("You 2 – 3 Amara K.")).toBeTruthy()
})
