import { StyleSheet } from "react-native"

import type { ColorRoles } from "@/constants/colors"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { typeStyle } from "@/constants/type"

/**
 * Shared styles for older stack screens that don't use the kit `Screen` yet.
 * Takes the redesign colour roles (`useAppTheme().colors`) and the system type scale.
 */
export function createAppScreenStyles(colors: ColorRoles) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: PlayTTSpacing.md,
      paddingTop: PlayTTSpacing.lg,
      gap: PlayTTSpacing.md,
    },
    scroll: {
      padding: PlayTTSpacing.md,
      gap: PlayTTSpacing.md,
    },
    accountScroll: {
      paddingHorizontal: PlayTTSpacing.md,
      paddingTop: PlayTTSpacing.lg,
      paddingBottom: PlayTTSpacing["2xl"],
      gap: PlayTTSpacing.lg,
    },
    title: {
      ...typeStyle("title2"),
      color: colors.label,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.separator,
      padding: PlayTTSpacing.md,
      gap: PlayTTSpacing.xs,
    },
    cardTitle: {
      ...typeStyle("headline"),
      color: colors.label,
    },
    cardMuted: {
      ...typeStyle("callout", "500"),
      color: colors.label,
    },
    cardSubtle: {
      ...typeStyle("footnote"),
      color: colors.secondaryLabel,
    },
    cardAccent: {
      ...typeStyle("footnote", "600"),
      color: colors.accentText,
    },
    cardPrice: {
      ...typeStyle("subheadline", "600"),
      color: colors.accentText,
    },
    empty: {
      gap: PlayTTSpacing.md,
      paddingVertical: PlayTTSpacing.xl,
    },
    emptyTitle: {
      ...typeStyle("title3"),
      color: colors.label,
    },
    emptyBody: {
      ...typeStyle("body"),
      color: colors.secondaryLabel,
    },
    signOut: {
      alignSelf: "flex-start",
      paddingVertical: PlayTTSpacing.sm,
    },
    signOutLabel: {
      ...typeStyle("headline"),
      color: colors.destructive,
    },
    stackScroll: {
      paddingHorizontal: PlayTTSpacing.md,
      paddingBottom: PlayTTSpacing["2xl"],
      gap: PlayTTSpacing.md,
    },
    stackDescription: {
      ...typeStyle("body"),
      color: colors.secondaryLabel,
    },
    loadingGate: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: PlayTTSpacing.xl,
    },
  })
}
