import { StatusBar } from "expo-status-bar"

import { BookingFlow } from "@/components/booking/booking-flow"
import { useAppTheme } from "@/hooks/use-app-theme"

export default function BookScreen() {
  const { scheme } = useAppTheme()

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <BookingFlow />
    </>
  )
}
