import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { GoalSheet } from "./goal-sheet"
import { DEFAULT_WEEKLY_GOAL_MINUTES, saveWeeklyGoal } from "@/lib/weekly-goal"

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))
jest.mock("react-native-reanimated", () => require("@/test/reanimated-mock"))
jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    scheme: "dark",
    colors: { fill: "#222", accent: "#0bf", accentText: "#0bf", onAccent: "#000", secondaryLabel: "#999", label: "#fff" },
  }),
}))
jest.mock("@/components/kit/sheet", () => ({ Sheet: ({ children, visible }: any) => (visible ? children : null) }))
jest.mock("@/components/activity/activity-ring", () => ({ ActivityRing: () => null }))
jest.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }))
jest.mock("@/components/ui/app-text", () => ({
  AppText: ({ children }: any) => {
    const { Text } = require("react-native")
    return <Text>{children}</Text>
  },
}))
jest.mock("@/components/kit/button", () => ({ Button: () => null }))
jest.mock("@/components/kit/pressable-scale", () => ({
  PressableScale: ({ children, onPress, accessibilityLabel, disabled }: any) => {
    const { Pressable } = require("react-native")
    return (
      <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={disabled}>
        {children}
      </Pressable>
    )
  },
}))

describe("GoalSheet", () => {
  beforeEach(async () => {
    await saveWeeklyGoal(DEFAULT_WEEKLY_GOAL_MINUTES)
  })

  it("steps the goal up and down without locking up", async () => {
    const screen = await render(<GoalSheet visible onClose={() => {}} weekMinutes={0} />)
    expect(screen.getByText("2h")).toBeTruthy()
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByLabelText("Raise the goal by 30 minutes"))
    await waitFor(() => expect(screen.getByText("3h 30m")).toBeTruthy())
    await fireEvent.press(screen.getByLabelText("Lower the goal by 30 minutes"))
    await waitFor(() => expect(screen.getByText("3h")).toBeTruthy())
  })
})
