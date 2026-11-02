import { StyleSheet } from "react-native"

import type { ProductThemeColors } from "@/constants/product-theme"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"

export function createTimingPanelStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    rootCompact: {
      flex: 0,
    },
    header: {
      gap: PlayTTSpacing.md,
      paddingBottom: PlayTTSpacing.sm,
    },
    slotList: {
      flex: 1,
    },
    slotListCompact: {
      flexGrow: 0,
      maxHeight: 280,
    },
    slotListContent: {
      gap: PlayTTSpacing.sm,
    },
    slotListEmpty: {
      flexGrow: 1,
      justifyContent: "center",
    },
    slotsLabel: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.muted,
    },
    venueChip: {
      alignSelf: "flex-start",
      paddingHorizontal: PlayTTSpacing.sm,
      paddingVertical: PlayTTSpacing.xs,
      borderRadius: PlayTTRadius.pill,
      backgroundColor: theme.elevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    venueChipLabel: {
      fontSize: 12,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    heading: {
      ...PlayTTTypography.headline,
      fontSize: 24,
      lineHeight: 28,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    dateRow: {
      flexDirection: "row",
      gap: PlayTTSpacing.xs,
    },
    dateChip: {
      minWidth: 64,
      alignItems: "center",
      paddingVertical: PlayTTSpacing.sm,
      paddingHorizontal: PlayTTSpacing.sm,
      borderRadius: PlayTTRadius.md,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dateChipSelected: {
      backgroundColor: PlayTTColors.primary,
      borderColor: PlayTTColors.primary,
    },
    dateChipDay: {
      fontSize: 11,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.muted,
    },
    dateChipDate: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    dateChipTextSelected: {
      color: PlayTTColors.primaryForeground,
    },
    toggleRow: {
      flexDirection: "row",
      gap: PlayTTSpacing.sm,
    },
    toggle: {
      flex: 1,
      alignItems: "center",
      paddingVertical: PlayTTSpacing.sm,
      borderRadius: PlayTTRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    toggleSelected: {
      backgroundColor: PlayTTColors.primary,
      borderColor: PlayTTColors.primary,
    },
    toggleLabel: {
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    toggleLabelSelected: {
      color: PlayTTColors.primaryForeground,
    },
    slotRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: PlayTTSpacing.md,
      borderRadius: PlayTTRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    slotRowSelected: {
      borderColor: PlayTTColors.primary,
    },
    slotTime: {
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    slotMeta: {
      fontSize: 12,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    slotPrice: {
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    empty: {
      gap: PlayTTSpacing.md,
      paddingVertical: PlayTTSpacing.lg,
      alignItems: "center",
    },
    emptyTitle: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.muted,
      textAlign: "center",
    },
  })
}

export function createGroupSizeSheetStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    list: {
      borderRadius: PlayTTRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
      marginBottom: PlayTTSpacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: PlayTTSpacing.md,
      paddingVertical: PlayTTSpacing.sm,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowActive: {
      backgroundColor: PlayTTColors.primary,
    },
    rowLabel: {
      fontSize: 15,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.foreground,
    },
    rowLabelActive: {
      color: PlayTTColors.primaryForeground,
    },
    rowMeta: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    rowMetaActive: {
      color: PlayTTColors.primaryForeground,
    },
    hint: {
      fontSize: 12,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      textAlign: "center",
      marginBottom: PlayTTSpacing.md,
    },
  })
}

export function createEditIntentSheetStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    intro: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      marginBottom: PlayTTSpacing.md,
      lineHeight: 20,
    },
    list: {
      gap: PlayTTSpacing.sm,
      marginBottom: PlayTTSpacing.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: PlayTTRadius.md,
      padding: PlayTTSpacing.md,
      backgroundColor: theme.card,
    },
    rowActive: {
      borderColor: PlayTTColors.primary,
      backgroundColor: theme.elevated,
    },
    rowLabel: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    rowMeta: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      marginTop: 2,
    },
    check: {
      fontSize: 18,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: PlayTTColors.primary,
    },
  })
}

export function createEditReviewSheetStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    anchor: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      marginBottom: PlayTTSpacing.md,
      lineHeight: 18,
    },
    diffBlock: {
      gap: PlayTTSpacing.sm,
      marginBottom: PlayTTSpacing.md,
    },
    diffRow: {
      gap: PlayTTSpacing.xs,
    },
    diffLabel: {
      fontSize: 12,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    diffValue: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.foreground,
      lineHeight: 22,
    },
    diffValueMuted: {
      color: theme.muted,
    },
    paymentRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: PlayTTSpacing.sm,
      marginBottom: PlayTTSpacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    paymentLabel: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.muted,
    },
    paymentAmount: {
      fontSize: 18,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: PlayTTColors.primary,
    },
    savingsNote: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      marginBottom: PlayTTSpacing.md,
      lineHeight: 18,
    },
    quotingRow: {
      marginBottom: PlayTTSpacing.md,
    },
  })
}
