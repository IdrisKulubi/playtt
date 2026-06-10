import { StyleSheet } from "react-native"

import type { ProductThemeColors } from "@/constants/product-theme"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"

export function createAppScreenStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: PlayTTSpacing.xl,
      paddingTop: PlayTTSpacing.lg,
      gap: PlayTTSpacing.md,
    },
    scroll: {
      padding: PlayTTSpacing.xl,
      gap: PlayTTSpacing.md,
    },
    accountScroll: {
      paddingHorizontal: PlayTTSpacing.xl,
      paddingTop: PlayTTSpacing.lg,
      paddingBottom: PlayTTSpacing["2xl"],
      gap: PlayTTSpacing.lg,
    },
    title: {
      ...PlayTTTypography.headline,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: PlayTTSpacing.md,
      gap: PlayTTSpacing.xs,
    },
    cardTitle: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    cardMuted: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.foreground,
    },
    cardSubtle: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    cardAccent: {
      fontSize: 12,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: PlayTTColors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    cardPrice: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: PlayTTColors.primary,
    },
    empty: {
      gap: PlayTTSpacing.md,
      paddingVertical: PlayTTSpacing.xl,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    emptyBody: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    signOut: {
      alignSelf: "flex-start",
      paddingVertical: PlayTTSpacing.sm,
    },
    signOutLabel: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: PlayTTColors.destructive,
    },
    stackScroll: {
      paddingHorizontal: PlayTTSpacing.xl,
      paddingBottom: PlayTTSpacing["2xl"],
      gap: PlayTTSpacing.md,
    },
    stackDescription: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      lineHeight: 20,
    },
    loadingGate: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: PlayTTSpacing.xl,
    },
  })
}
