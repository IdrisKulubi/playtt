import { type Href, Redirect } from "expo-router"

// Coach used to live behind a Home segment; old links now open its own screen.
// Cast until Expo regenerates typed routes on the next dev-server start.
export default function CoachTabRedirect() {
  return <Redirect href={"/(app)/coach" as Href} />
}
