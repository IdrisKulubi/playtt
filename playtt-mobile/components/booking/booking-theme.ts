import { StyleSheet } from "react-native"

import type { ProductThemeColors } from "@/constants/product-theme"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"

export function createBookingProgressStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: PlayTTSpacing.sm,
    },
    item: {
      flex: 1,
      alignItems: "center",
      gap: PlayTTSpacing.xs,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.border,
    },
    dotActive: {
      backgroundColor: PlayTTColors.primary,
    },
    label: {
      fontSize: 11,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.muted,
    },
    labelActive: {
      color: theme.foreground,
    },
  })
}

export function createBookingFlowStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    timingPage: {
      flex: 1,
      paddingHorizontal: PlayTTSpacing.lg,
      paddingTop: PlayTTSpacing.lg,
    },
    timingHeader: {
      marginBottom: PlayTTSpacing.md,
    },
    scroll: {
      padding: PlayTTSpacing.lg,
      gap: PlayTTSpacing.md,
    },
    scrollWithBar: {
      paddingBottom: 120,
    },
    loading: {
      flex: 1,
      padding: PlayTTSpacing.lg,
      backgroundColor: theme.background,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: PlayTTSpacing.xl,
      backgroundColor: theme.background,
    },
    emptyTitle: {
      ...PlayTTTypography.title,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    emptyBody: {
      ...PlayTTTypography.body,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      textAlign: "center",
    },
    heading: {
      ...PlayTTTypography.headline,
      fontSize: 24,
      lineHeight: 28,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    section: {
      gap: PlayTTSpacing.md,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: PlayTTSpacing.md,
      gap: PlayTTSpacing.xs,
    },
    cardSelected: {
      borderColor: PlayTTColors.primary,
    },
    cardTitle: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    cardBody: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    confirmedTitle: {
      ...PlayTTTypography.headline,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    confirmedBody: {
      ...PlayTTTypography.body,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    confirmedVenue: {
      fontSize: 20,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
      marginTop: PlayTTSpacing.sm,
    },
    confirmedMeta: {
      fontSize: 15,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.foreground,
    },
  })
}

export function createTimingPanelStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    header: {
      gap: PlayTTSpacing.md,
      paddingBottom: PlayTTSpacing.sm,
    },
    slotList: {
      flex: 1,
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

export function createCheckoutBarStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    bar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: PlayTTSpacing.lg,
      paddingTop: PlayTTSpacing.sm,
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      gap: PlayTTSpacing.sm,
    },
    summary: {
      flex: 1,
      minWidth: 0,
    },
    summaryText: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    button: {
      minWidth: 132,
    },
  })
}

export function createConfirmSheetStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    summary: {
      gap: PlayTTSpacing.xs,
      marginBottom: PlayTTSpacing.md,
    },
    venue: {
      fontSize: 18,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    time: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.foreground,
    },
    meta: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    tier: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.medium,
      color: PlayTTColors.primary,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: PlayTTSpacing.sm,
      paddingTop: PlayTTSpacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    totalLabel: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.muted,
    },
    totalAmount: {
      fontSize: 20,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    notesToggle: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: PlayTTColors.primary,
      marginBottom: PlayTTSpacing.sm,
    },
    notesInput: {
      minHeight: 72,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: PlayTTRadius.md,
      padding: PlayTTSpacing.md,
      backgroundColor: theme.input,
      color: theme.foreground,
      fontFamily: PlayTTFontFamilies.regular,
      textAlignVertical: "top",
      marginBottom: PlayTTSpacing.sm,
    },
    subcopy: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      textAlign: "center",
      marginBottom: PlayTTSpacing.md,
    },
  })
}
