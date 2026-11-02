import React from "react"
import { render } from "@testing-library/react-native"
import { StyleSheet, Text } from "react-native"
import { ActivityStatsStickyChrome } from "./activity-stats-sticky-chrome"

jest.mock("@/constants/theme", () => ({ resolveColorScheme: () => "dark" }))
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "dark" }))
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}))
jest.mock("@/components/ui/liquid-glass-surface", () => ({
  LiquidGlassSurface: () => null,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  liquidGlassFill: require("react-native").StyleSheet.absoluteFill,
}))

test("sticky decorations stay out of layout flow with RN 0.86 styles", async () => {
  const screen = await render(
    <ActivityStatsStickyChrome><Text>Month</Text></ActivityStatsStickyChrome>
  )
  const expected = { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }
  const backdrop = screen.getByTestId("stats-chrome-backdrop")
  expect(backdrop.props.pointerEvents).toBe("none")
  expect(StyleSheet.flatten(backdrop.props.style)).toMatchObject(expected)
  expect(StyleSheet.flatten(screen.getByTestId("stats-chrome-fade").props.style)).toMatchObject(expected)
  expect(screen.getByText("Month")).toBeTruthy()
})
