import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import CommunityScreen from "@/app/(app)/(tabs)/community"
import { fetchCommunityMe, fetchCommunityPlayers, stopOpenToPlay } from "@/lib/community-api"
import type { CommunityMe, CommunityPlayer } from "@/lib/community-types"

const mockPush = jest.fn()

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require("react")
  return {
    router: { push: (...args: unknown[]) => mockPush(...args) },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})
jest.mock("@/lib/community-api", () => ({
  fetchCommunityMe: jest.fn(),
  fetchCommunityPlayers: jest.fn(),
  stopOpenToPlay: jest.fn(),
  goOpenToPlay: jest.fn(),
}))
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("react-native-reanimated", () => require("@/test/reanimated-mock"))
jest.mock("react-native-safe-area-context", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native")
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "dark" }))
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}))
jest.mock("expo-image", () => ({ Image: () => null }))
jest.mock("phosphor-react-native/src/icons/ChatCircleDots", () => ({ ChatCircleDots: () => null }))
jest.mock("phosphor-react-native/src/icons/Fire", () => ({ Fire: () => null }))
jest.mock("phosphor-react-native/src/icons/Handshake", () => ({ Handshake: () => null }))
jest.mock("phosphor-react-native/src/icons/IdentificationCard", () => ({ IdentificationCard: () => null }))
jest.mock("phosphor-react-native/src/icons/Medal", () => ({ Medal: () => null }))
jest.mock("phosphor-react-native/src/icons/PingPong", () => ({ PingPong: () => null }))
jest.mock("@/components/ui/liquid-glass-surface", () => ({
  LiquidGlassSurface: () => null,
  useNativeLiquidGlass: () => false,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  liquidGlassFill: require("react-native").StyleSheet.absoluteFill,
}))
jest.mock("@/components/ui/bottom-sheet", () => ({
  BottomSheet: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
    visible ? children : null,
}))
jest.mock("@/components/ui/skeleton", () => ({ Skeleton: () => null }))
jest.mock("@/components/ui/glass-segment-control", () => ({
  GlassSegmentControl: ({ options, onChange }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable, Text } = require("react-native")
    return options.map((option: any) => (
      <Pressable key={option.value} onPress={() => onChange(option.value)}>
        <Text>{option.label}</Text>
      </Pressable>
    ))
  },
}))

const fetchMe = jest.mocked(fetchCommunityMe)
const fetchPlayers = jest.mocked(fetchCommunityPlayers)
const stopOpen = jest.mocked(stopOpenToPlay)

const NO_STATS = {
  matches: null,
  winRate: null,
  reliability: null,
  streakWeeks: null,
  kudos: null,
  hours: null,
}

function me(overrides: Partial<CommunityMe> = {}, visible = true): CommunityMe {
  return {
    id: "user_me",
    displayName: "Idris K.",
    image: null,
    skillLevel: "intermediate",
    profile: {
      communityVisible: visible,
      bio: null,
      playStyle: null,
      handedness: null,
      usualTimes: [],
      requestPolicy: "everyone",
      showAtVenue: false,
      foundingPlayer: false,
    },
    availability: null,
    homeVenue: { id: "venue_parklands", name: "Parklands" },
    counts: { followers: 0, following: 0 },
    stats: NO_STATS,
    ...overrides,
  }
}

const AMARA: CommunityPlayer = {
  id: "user_amara",
  displayName: "Amara K.",
  image: null,
  skillLevel: "pro",
  playStyle: null,
  handedness: null,
  bio: null,
  usualTimes: [],
  foundingPlayer: false,
  availability: null,
  relationship: { following: false, followsYou: false, rallyPartner: false, blockedByYou: false, canMessage: true },
  stats: NO_STATS,
}

beforeEach(() => {
  jest.clearAllMocks()
  fetchPlayers.mockResolvedValue({
    players: [AMARA],
    nextCursor: null,
    venue: { id: "venue_parklands", name: "Parklands" },
  })
})

test("players without a card see the intro gate and no player list", async () => {
  fetchMe.mockResolvedValue(me({}, false))
  const screen = await render(<CommunityScreen />)

  fireEvent.press(await screen.findByText("Create my card"))
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/(app)/account/community-profile",
    params: { setup: "1" },
  })
  expect(fetchPlayers).not.toHaveBeenCalled()
  expect(screen.queryByText("Open now")).toBeNull()
})

test("open players see their status bar and can stop", async () => {
  fetchMe.mockResolvedValue(
    me({
      availability: {
        window: "now",
        startsAt: "2026-10-28T16:00:00.000Z",
        endsAt: "2026-10-28T18:00:00.000Z",
        note: null,
        lookingForDoubles: true,
        openNow: true,
      },
    }),
  )
  stopOpen.mockResolvedValue(me())
  const screen = await render(<CommunityScreen />)

  expect(await screen.findByText("You're open · until 9PM")).toBeTruthy()
  expect(screen.getByText("Looking for doubles")).toBeTruthy()

  fireEvent.press(screen.getByLabelText("Stop being open to play"))
  await waitFor(() => expect(stopOpen).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByText("You're open · until 9PM")).toBeNull())
})

test("segments and filter chips change the player query", async () => {
  fetchMe.mockResolvedValue(me())
  const screen = await render(<CommunityScreen />)

  expect(await screen.findByText("AMARA K.")).toBeTruthy()
  expect(fetchPlayers).toHaveBeenLastCalledWith({ status: "open" })

  fireEvent.press(screen.getByText("Everyone"))
  await waitFor(() => expect(fetchPlayers).toHaveBeenLastCalledWith({ status: "all" }))

  fireEvent.press(screen.getByText("Elite"))
  await waitFor(() => expect(fetchPlayers).toHaveBeenLastCalledWith({ status: "all", skill: "pro" }))

  fireEvent.press(screen.getByText("2v2"))
  await waitFor(() =>
    expect(fetchPlayers).toHaveBeenLastCalledWith({ status: "all", skill: "pro", doubles: true }),
  )

  fireEvent.press(screen.getByText("Following"))
  await waitFor(() =>
    expect(fetchPlayers).toHaveBeenLastCalledWith({ status: "all", following: true, skill: "pro", doubles: true }),
  )
})

test("tapping a card opens the player profile", async () => {
  fetchMe.mockResolvedValue(me())
  const screen = await render(<CommunityScreen />)

  fireEvent.press(await screen.findByLabelText(/^Amara K\., Elite tier/))
  expect(mockPush).toHaveBeenCalledWith("/community/player/user_amara")
})
