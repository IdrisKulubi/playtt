import { type ReactNode, useMemo } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountScreenHeader } from "@/components/account/account-screen-header"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type AccountStackScreenProps = {
  title: string
  description?: string
  children: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
  showHeader?: boolean
}

export function AccountStackScreen({
  title,
  description,
  children,
  contentContainerStyle,
  showHeader = true,
}: AccountStackScreenProps) {
  const theme = useProductTheme()
  const screenStyles = useMemo(() => createAppScreenStyles(theme), [theme])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          paddingHorizontal: 20,
          paddingTop: PlayTTSpacing.sm,
          paddingBottom: PlayTTSpacing["2xl"],
          gap: PlayTTSpacing.md,
        },
        heroTitle: {
          ...PlayTTTypography.headline,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        description: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 20,
        },
        intro: {
          gap: PlayTTSpacing.xs,
          marginBottom: PlayTTSpacing["2xs"],
        },
      }),
    [theme],
  )

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={["top", "left", "right"]}>
      {showHeader ? <AccountScreenHeader title={title} /> : null}
      <ScrollView
        contentContainerStyle={[styles.scroll, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        {!showHeader ? (
          <View style={styles.intro}>
            <Text style={styles.heroTitle}>{title}</Text>
            {description ? (
              <Text style={styles.description}>{description}</Text>
            ) : null}
          </View>
        ) : description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}
