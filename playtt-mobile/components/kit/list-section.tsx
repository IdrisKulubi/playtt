import { Children, Fragment, isValidElement, type ReactNode } from "react"
import { StyleSheet, View } from "react-native"
import Animated from "react-native-reanimated"

import { ScrollEdgeFades, useScrollEdgeFades } from "@/components/kit/edge-fade"
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
  /**
   * Cap the list's height; longer lists then scroll inside their own box
   * while the page stays still. Leave a row half showing so it looks scrollable.
   */
  maxHeight?: number
  children: ReactNode
}

const ICON_ROW_INSET = PlayTTSpacing.md + KitLayout.iconTile + PlayTTSpacing.sm

/** iOS inset grouped list: rows on one rounded surface, inset separators. */
export function ListSection({
  header,
  footer,
  separatorInset = ICON_ROW_INSET,
  maxHeight,
  children,
}: ListSectionProps) {
  const { scheme, colors } = useAppTheme()
  const fades = useScrollEdgeFades()
  const rows = Children.toArray(children).filter(isValidElement)
  const list = rows.map((row, index) => (
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
  ))

  return (
    <View style={styles.section}>
      {header ? (
        <AppText variant="footnote" color="secondaryLabel" accessibilityRole="header" style={styles.header}>
          {header}
        </AppText>
      ) : null}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {maxHeight ? (
          <>
            <Animated.ScrollView
              style={{ maxHeight }}
              {...fades.scrollProps}
              // Lets the box scroll on its own inside the page's scroll view (Android).
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              accessibilityLabel={header ? `${header}, scrolls` : undefined}
            >
              {list}
            </Animated.ScrollView>
            <ScrollEdgeFades fades={fades} color={colors.surface} scheme={scheme} />
          </>
        ) : (
          list
        )}
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
