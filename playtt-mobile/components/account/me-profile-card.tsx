import { Image } from "expo-image"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { getInitials, getOAuthProviderLabel } from "@/lib/account-utils"
import type { UserProfile } from "@/lib/user-api"

const AVATAR_SIZE = 72

type MeProfileCardProps = {
  profile: UserProfile
  onEdit: () => void
  onVerifyEmail: () => void
}

/** Top of Me: who you are, and the one thing to fix if your email isn't verified. */
export function MeProfileCard({ profile, onEdit, onVerifyEmail }: MeProfileCardProps) {
  const { colors } = useAppTheme()
  const provider = getOAuthProviderLabel(profile.authMethods)

  return (
    <Card>
      <View style={styles.row}>
        {profile.image ? (
          <Image
            source={{ uri: profile.image }}
            style={styles.avatar}
            contentFit="cover"
            accessibilityLabel={`Photo of ${profile.name}`}
          />
        ) : (
          <View
            style={[styles.avatar, styles.initials, { backgroundColor: colors.fill }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <AppText variant="title2" color="accentText">
              {getInitials(profile.name)}
            </AppText>
          </View>
        )}
        <View style={styles.text}>
          <AppText variant="title2" accessibilityRole="header">
            {profile.name}
          </AppText>
          <AppText variant="subheadline" color="secondaryLabel">
            {profile.email}
          </AppText>
          {provider ? (
            <AppText variant="footnote" color="secondaryLabel">
              {provider}
            </AppText>
          ) : null}
        </View>
      </View>

      {!profile.emailVerified ? (
        <View style={[styles.warning, { backgroundColor: colors.fill }]}>
          <View style={styles.warningText}>
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
            <AppText variant="callout" weight="600" color="warning" style={styles.flex}>
              Your email isn&apos;t verified yet
            </AppText>
          </View>
          <Button label="Verify email" variant="secondary" onPress={onVerifyEmail} />
        </View>
      ) : null}

      <Button label="Edit profile" variant="secondary" onPress={onEdit} style={styles.edit} />
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.md, flexWrap: "wrap" },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  initials: { alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 160, gap: 2 },
  warning: {
    marginTop: PlayTTSpacing.md,
    padding: PlayTTSpacing.sm,
    borderRadius: 12,
    gap: PlayTTSpacing.sm,
  },
  warningText: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
  flex: { flex: 1 },
  edit: { marginTop: PlayTTSpacing.md },
})
