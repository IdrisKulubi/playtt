import { Redirect } from "expo-router"

export default function CoachScreen() {
  return (
    <Redirect
      href={{
        pathname: "/(app)/(tabs)",
        params: { homeTab: "coach" },
      }}
    />
  )
}
