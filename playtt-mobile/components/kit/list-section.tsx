import { Children, Fragment, isValidElement, type ReactNode } from "react"
import { StyleSheet, View } from "react-native"

import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type ListSectionProps = {
  /** Short sentence-case heading above the group. */
  header?: string
  /** Helper text under the group. */
  footer?: string
  /** Where separators start; defaults to the text edge of rows with icons. */
  separatorInset?: number
  children: ReactNode
}

const ICON_ROW_INSET = PlayTTSpacing.md + KitLayout.iconTile + PlayTTSpacing.sm

/** iOS inset grouped list: rows on one rounded surface, inset separators. */
export function ListSection({
  header,
  footer,
  separatorInset = ICON_ROW_INSET,
  children,
}: ListSectionProps) {
  const { colors } = useAppTheme()
  const rows = Children.toArray(children).filter(isValidElement)

  return (
    <View style={styles.section}>
      {header ? (
        <AppText variant="footnote" color="secondaryLabel" accessibilityRole="header" style={styles.header}>
          {header}
        </AppText>
      ) : null}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? (
              <View
                style={[
                  styles.separator,
                  { marginLeft: separatorInset, backgroundColor: colors.separator },
                ]}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <AppText variant="footnote" color="secondaryLabel" style={styles.header}>
          {footer}
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: PlayTTSpacing.xs },
  header: { paddingHorizontal: PlayTTSpacing.md },
  group: {
    borderRadius: KitLayout.groupRadius,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  separator: { height: StyleSheet.hairlineWidth },
})
