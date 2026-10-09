import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { PlayerStatsPanel, shiftStatsDate } from "./player-stats-panel"
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
  SkeletonGroup: () => null,
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

test("period navigation handles leap years and month boundaries", () => {
  expect(shiftStatsDate("2024-03-01", "day", -1)).toBe("2024-02-29")
  expect(shiftStatsDate("2026-01-31", "month", -1)).toBe("2025-12-01")
  expect(shiftStatsDate("2026-10-09", "year", -1)).toBe("2025-01-01")
})
test("year buckets drill into the selected month", async () => {
  const screen = render(<PlayerStatsPanel />)
  await screen.findByText("The details")
  fireEvent.press(screen.getByText("Year"))
  await waitFor(() =>
    expect(fetchStats).toHaveBeenLastCalledWith(
      "year",
      expect.stringMatching(/-01-01$/)
    )
  )
  await screen.findByText("The details")
  fireEvent.press(screen.getByLabelText("Jan: 3h. Show details"))
  fireEvent.press(screen.getByLabelText(/View sessions for January/))
  fireEvent.press(screen.getByText("Explore this month"))
  await waitFor(() =>
    expect(fetchStats).toHaveBeenLastCalledWith(
      "month",
      expect.stringMatching(/-01-01$/)
    )
  )
})
test("hourly details use Nairobi hours with distinct bucket selections", async () => {
  const screen = render(<PlayerStatsPanel />)
  await screen.findByText("The details")
  fireEvent.press(screen.getByText("Day"))
  await screen.findByText("Swipe the chart. Tap a time to explore.")
  fireEvent.press(screen.getByLabelText("10: 1h 30m. Show details"))
  fireEvent.press(screen.getByLabelText(/View sessions for 10/))
  expect(screen.getAllByText(/reservation price/)).toHaveLength(1)
})
test("request failures show retry and never sample analytics", async () => {
  fetchStats.mockRejectedValueOnce(new Error("offline"))
  const screen = render(<PlayerStatsPanel />)
  await screen.findByText("Stats couldn’t load")
  expect(screen.queryByText("The details")).toBeNull()
  fireEvent.press(screen.getByText("Try again"))
  await screen.findByText("The details")
  expect(fetchStats).toHaveBeenCalledTimes(2)
})
