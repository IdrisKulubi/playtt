import { Redirect, useLocalSearchParams } from "expo-router"

function buildAuthHref(mode: string | string[] | undefined) {
  const value = Array.isArray(mode) ? mode[0] : mode
  return value === "sign-up" ? "/?mode=sign-up" : "/?mode=sign-in"
}

export default function AuthRedirectScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  return <Redirect href={buildAuthHref(mode)} />
}
