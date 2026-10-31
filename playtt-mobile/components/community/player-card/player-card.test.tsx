import React from "react"
import { render } from "@testing-library/react-native"

import type { CommunityPlayer } from "@/lib/community-types"

import {
  EMPTY_STAT,
  formatNairobiClock,
  formatStat,
  playerCardAccessibilityLabel,
  statusRibbon,
  tierForSkill,
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

test("skill levels map onto card tiers", () => {
  expect(tierForSkill("beginner")).toBe("rookie")
  expect(tierForSkill("intermediate")).toBe("club")
  expect(tierForSkill("pro")).toBe("elite")
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
    "Amara K., Club tier, open now until 9 PM, 42 matches, 61 percent wins",
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
    expect(screen.getByLabelText(/^Amara K\., (Rookie|Club|Elite) tier/)).toBeTruthy()
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
