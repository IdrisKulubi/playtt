import { type Href, router } from "expo-router"
import { StyleSheet } from "react-native"

import { UserAvatar } from "@/components/account/user-avatar"
import { PressableScale } from "@/components/kit/pressable-scale"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useProfileSummary } from "@/hooks/use-profile-summary"

const ME_HREF = "/(app)/account" as Href

/** Photo size; the touch area around it is 48 pt. */
const SIZE = 44

/**
 * Your photo, pinned in the top corner like Apple's own apps. It opens Me,
 * where your details and settings live.
 */
export function ProfileButton() {
  const { colors } = useAppTheme()
  const profile = useProfileSummary()

  return (
    <PressableScale
      onPress={() => router.push(ME_HREF)}
      accessibilityLabel="Your account"
      accessibilityHint="Opens your details and settings"
      hitSlop={4}
      style={[styles.ring, { borderColor: colors.separator }]}
    >
      <UserAvatar image={profile?.image} size={SIZE} />
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE + 4,
    height: SIZE + 4,
    borderRadius: (SIZE + 4) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
})
