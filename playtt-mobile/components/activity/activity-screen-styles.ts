import { StyleSheet } from "react-native"

import type { ProductThemeColors } from "@/constants/product-theme"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"

export function createActivityHeaderStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    band: {
      marginHorizontal: -PlayTTSpacing.xl,
      marginTop: -PlayTTSpacing.xl,
      marginBottom: PlayTTSpacing.md,
      paddingHorizontal: PlayTTSpacing.xl,
      paddingTop: PlayTTSpacing.lg,
      paddingBottom: PlayTTSpacing.lg,
      backgroundColor: theme.elevated,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: PlayTTSpacing.sm,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: PlayTTSpacing.sm,
    },
    intro: {
      flex: 1,
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      lineHeight: 22,
    },
    sectionLabel: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: PlayTTSpacing.sm,
      marginBottom: PlayTTSpacing.xs,
    },
    leadHeadline: {
      ...PlayTTTypography.headline,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    leadSubline: {
      fontSize: 15,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      marginTop: PlayTTSpacing["2xs"],
    },
    hairlineRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: PlayTTSpacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      gap: PlayTTSpacing.sm,
    },
    hairlineRowLast: {
      borderBottomWidth: 0,
    },
    hairlineLabel: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.foreground,
    },
    hairlineValue: {
      fontSize: 15,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    spendFooter: {
      paddingTop: PlayTTSpacing.lg,
      marginTop: PlayTTSpacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      gap: PlayTTSpacing["2xs"],
    },
    spendLabel: {
      fontSize: 12,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    spendValue: {
      fontSize: 15,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
  })
}
