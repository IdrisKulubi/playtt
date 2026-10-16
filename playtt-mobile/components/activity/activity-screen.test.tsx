import React from "react"
import { ScrollView, View } from "react-native"
import { fireEvent, render, waitFor } from "@testing-library/react-native"
import ActivityScreen from "../../app/(app)/(tabs)/activity"
import { fetchActivityStats } from "@/lib/activity-stats-api"
import { sampleActivityStats } from "@/lib/mock/mock-activity-stats"

jest.mock("@/lib/activity-stats-api", () => ({ fetchActivityStats: jest.fn() }))
jest.mock("@/lib/mock/mock-config", () => ({ USE_LIVE_PLAYER_STATS: true }))
jest.mock("@/hooks/use-product-theme", () => ({
  useProductTheme: () => ({
    foreground: "#fff",
    muted: "#ccc",
    border: "#555",
    elevated: "#222",
  }),
  useSkeletonSurface: () => "dark",
}))
jest.mock("phosphor-react-native/src/icons/CaretDown", () => ({
  CaretDownIcon: () => null,
}))
jest.mock("phosphor-react-native/src/icons/CaretLeft", () => ({
  CaretLeftIcon: () => null,
}))
jest.mock("phosphor-react-native/src/icons/CaretRight", () => ({
  CaretRightIcon: () => null,
}))
jest.mock("phosphor-react-native/src/icons/Export", () => ({
  ExportIcon: () => null,
}))
jest.mock("phosphor-react-native/src/icons/CalendarBlank", () => ({
  CalendarBlankIcon: () => null,
}))

jest.mock("@/components/ui/glass-panel", () => ({
  GlassPanel: ({ children }: any) => children,
}))
jest.mock("@/components/ui/preview-badge", () => ({ PreviewBadge: () => null }))
jest.mock("@/components/ui/skeleton/skeleton", () => ({
  Skeleton: () => null,
  SkeletonGroup: ({ children }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require("react-native")
    return <View testID="stats-loading">{children}</View>
  },
}))
jest.mock("@/components/activity/stats-share-sheet", () => ({
  StatsShareSheet: () => null,
}))
jest.mock("@/components/ui/bottom-sheet", () => ({
  BottomSheet: ({ children, visible }: any) => (visible ? children : null),
}))
jest.mock("@/components/ui/glass-segment-control", () => ({
  GlassSegmentControl: ({ options, onChange }: any) => {
    // Jest mock factories load native components lazily after hoisting.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable, Text } = require("react-native")
    return options.map((option: any) => (
      <Pressable key={option.value} onPress={() => onChange(option.value)}>
        <Text>{option.label}</Text>
      </Pressable>
    ))
  },
}))
const fetchStats = jest.mocked(fetchActivityStats)
beforeEach(() => {
  jest.clearAllMocks()
  fetchStats.mockImplementation(async (period, date) =>
    sampleActivityStats(period, date)
  )
})

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }))
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}))
jest.mock("@/components/activity/activity-header", () => ({ ActivityHeader: () => null }))
jest.mock("@/components/activity/activity-stats-sticky-chrome", () => ({
  ActivityStatsStickyChrome: ({ children }: any) => children,
}))
jest.mock("@/components/activity/replay-library", () => ({ ReplayLibrary: () => null }))
jest.mock("@/components/activity/replay-share-bar", () => ({ ReplayShareDock: () => null }))
jest.mock("@/components/coach/clip-pack-purchase-sheet", () => ({ ClipPackPurchaseSheet: () => null }))
jest.mock("@/lib/replay-credits-api", () => ({ fetchActivityReplayCredits: jest.fn() }))

test("Activity Stats mounts period controls and analytics when selected", async () => {
  const screen = render(<ActivityScreen />)
  expect(fetchStats).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText("Stats"))
  const scroll = screen.UNSAFE_getAllByType(ScrollView)[0]
  expect(scroll.props.stickyHeaderIndices).toEqual([2])
  expect(scroll.props.children[2].type).toBe(View)
  expect(screen.getByText("Year")).toBeTruthy()
  expect(screen.getByText("Month")).toBeTruthy()
  expect(screen.getByText("Day")).toBeTruthy()
  await screen.findByText("The details")
  fireEvent.press(screen.getByText("Year"))
  await waitFor(() => expect(fetchStats).toHaveBeenLastCalledWith("year", expect.stringMatching(/-01-01$/)))
})

test("Activity Stats keeps controls visible during loading and supports retry after failure", async () => {
  let rejectRequest!: (reason: Error) => void
  fetchStats.mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject }))
  const screen = render(<ActivityScreen />)
  fireEvent.press(screen.getByText("Stats"))
  expect(screen.getByText("Month")).toBeTruthy()
  expect(screen.getByTestId("stats-loading")).toBeTruthy()
  rejectRequest(new Error("offline"))
  await screen.findByText("Stats couldn’t load")
  expect(screen.getByText("Day")).toBeTruthy()
  fireEvent.press(screen.getByText("Try again"))
  await screen.findByText("The details")
  fireEvent.press(screen.getByText("Highlights"))
  expect(screen.queryByText("Year")).toBeNull()
  fireEvent.press(screen.getByText("Stats"))
  await screen.findByText("The details")
})


