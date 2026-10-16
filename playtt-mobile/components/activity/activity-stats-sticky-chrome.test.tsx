import React from "react"
import { render } from "@testing-library/react-native"
import { StyleSheet, Text, View } from "react-native"
import Svg from "react-native-svg"
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

test("sticky decorations stay out of layout flow with RN 0.86 styles", () => {
  const screen = render(
    <ActivityStatsStickyChrome><Text>Month</Text></ActivityStatsStickyChrome>
  )
  const backdrop = screen.UNSAFE_getAllByType(View).find(
    (view) => view.props.pointerEvents === "none"
  )
  const expected = { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }
  expect(StyleSheet.flatten(backdrop?.props.style)).toEqual(expected)
  expect(StyleSheet.flatten(screen.UNSAFE_getByType(Svg).props.style)).toEqual(expected)
  expect(screen.getByText("Month")).toBeTruthy()
})

