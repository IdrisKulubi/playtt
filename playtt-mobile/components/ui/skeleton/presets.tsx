import { Fragment, type ReactNode } from "react"
import { StyleSheet, View } from "react-native"

import { Card } from "@/components/kit/card"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

import { Skeleton, SkeletonCircle, SkeletonGroup, type SkeletonSurface } from "./skeleton"

/**
 * Loading placeholders shaped like the real screens: the same cards, grouped
 * lists, buttons and gaps, so nothing jumps when the content arrives.
 */

type PresetProps = {
  /** @deprecated Ignored; skeletons follow the phone's light/dark setting. */
  surface?: SkeletonSurface
}

/** Screen readers hear "Loading" once, instead of a pile of empty shapes. */
function LoadingRegion({ children, gap = "md" }: { children: ReactNode; gap?: keyof typeof PlayTTSpacing }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading" style={{ gap: PlayTTSpacing[gap] }}>
      {children}
    </View>
  )
}

/** A big button, same height and pill shape as the kit Button. */
function ButtonBone({ flex = false }: { flex?: boolean }) {
  return (
    <Skeleton
      height={KitLayout.buttonHeight}
      borderRadius={KitLayout.buttonHeight / 2}
      style={flex ? styles.flex : undefined}
    />
  )
}

/** One inset grouped list (like ListSection), with an optional header. */
function ListSectionBone({
  rows = 3,
  header = true,
  icons = true,
  detailLines = 1,
}: {
  rows?: number
  header?: boolean
  icons?: boolean
  /** Lines of small text under each row's title; booking rows have two. */
  detailLines?: number
}) {
  const { colors } = useAppTheme()

  return (
    <View style={styles.section}>
      {header ? <Skeleton width="30%" height={12} style={styles.sectionHeader} /> : null}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {Array.from({ length: rows }).map((_, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View
                style={[
                  styles.separator,
                  { marginLeft: icons ? 58 : PlayTTSpacing.md, backgroundColor: colors.separator },
                ]}
              />
            ) : null}
            <View style={styles.row}>
              {icons ? <Skeleton width={KitLayout.iconTile} height={KitLayout.iconTile} borderRadius={8} /> : null}
              <View style={styles.rowText}>
                <Skeleton width={index % 2 ? "45%" : "60%"} height={17} />
                {Array.from({ length: detailLines }).map((_, line) => (
                  <Skeleton
                    key={line}
                    width={line === detailLines - 1 && detailLines > 1 ? "50%" : index % 2 ? "78%" : "68%"}
                    height={13}
                  />
                ))}
              </View>
            </View>
          </Fragment>
        ))}
      </View>
    </View>
  )
}

/** Play tab: the next-game card. */
export function HomeTicketSkeleton(_props: PresetProps & { embedded?: boolean }) {
  const { colors } = useAppTheme()

  return (
    <LoadingRegion>
      <Card>
        <View style={styles.stack}>
          <Skeleton width="28%" height={13} />
          <SkeletonGroup gap="xs">
            <Skeleton width="62%" height={30} borderRadius={8} />
            <Skeleton width="42%" height={18} />
          </SkeletonGroup>
          <View style={[styles.divider, { backgroundColor: colors.separator }]} />
          <SkeletonGroup gap="sm">
            <Skeleton width="70%" height={16} />
            <Skeleton width="50%" height={16} />
          </SkeletonGroup>
          <View style={styles.buttonRow}>
            <ButtonBone flex />
            <ButtonBone flex />
          </View>
        </View>
      </Card>
    </LoadingRegion>
  )
}

export function UpcomingCardSkeleton(props: PresetProps) {
  return <HomeTicketSkeleton {...props} />
}

/** Bookings tab: lists grouped by day. */
export function BookingListSkeleton(_props: PresetProps) {
  return (
    <LoadingRegion gap="lg">
      <View style={styles.dayGroups}>
        <ListSectionBone rows={1} detailLines={2} />
        <ListSectionBone rows={1} detailLines={2} />
        <ButtonBone />
      </View>
      <ListSectionBone rows={3} detailLines={2} />
    </LoadingRegion>
  )
}

/** Booking details: time and day, status, then the details list. */
export function BookingDetailSkeleton(_props: PresetProps) {
  return (
    <LoadingRegion gap="lg">
      <SkeletonGroup gap="xs">
        <Skeleton width="58%" height={30} borderRadius={8} />
        <Skeleton width="48%" height={18} />
        <Skeleton width="30%" height={16} style={styles.statusLine} />
      </SkeletonGroup>
      <ListSectionBone rows={3} header={false} />
      <Skeleton height={140} borderRadius={KitLayout.cardRadius} />
      <ButtonBone />
    </LoadingRegion>
  )
}

/** Me tab: profile card, then the settings lists. */
export function AccountHubSkeleton(_props: PresetProps) {
  return (
    <LoadingRegion gap="lg">
      <Card>
        <View style={styles.profile}>
          <SkeletonCircle size={64} />
          <View style={styles.rowText}>
            <Skeleton width="55%" height={22} borderRadius={8} />
            <Skeleton width="75%" height={14} />
          </View>
        </View>
      </Card>
      <ListSectionBone rows={2} />
      <ListSectionBone rows={3} />
    </LoadingRegion>
  )
}

/** Forms: a label above each field, then the main button. */
export function AuthFormSkeleton(_props: PresetProps) {
  return (
    <LoadingRegion gap="lg">
      {Array.from({ length: 3 }).map((_, index) => (
        <SkeletonGroup key={index} gap="xs">
          <Skeleton width="30%" height={13} />
          <Skeleton height={KitLayout.rowMinHeight} borderRadius={KitLayout.groupRadius} />
        </SkeletonGroup>
      ))}
      <ButtonBone />
    </LoadingRegion>
  )
}

/** Booking, first step: venue rows. */
export function VenueCardSkeleton(_props: PresetProps) {
  return (
    <LoadingRegion gap="lg">
      <ListSectionBone rows={2} />
      <ButtonBone />
    </LoadingRegion>
  )
}

/** Time buttons, two to a row like the real time grid. */
export function SlotListSkeleton(_props: PresetProps) {
  return (
    <LoadingRegion>
      <View style={styles.slotGrid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} height={72} borderRadius={16} style={styles.slotCell} />
        ))}
      </View>
    </LoadingRegion>
  )
}

/** Day strip plus time buttons. */
export function TimingPanelSkeleton(_props: PresetProps) {
  return (
    <LoadingRegion gap="lg">
      <View style={styles.dayRow}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} width={72} height={68} borderRadius={16} />
        ))}
      </View>
      <SlotListSkeleton />
    </LoadingRegion>
  )
}

/** Progress: a grid of replay thumbnails with titles. */
export function ReplayClipGridSkeleton({ cardCount = 4 }: PresetProps & { cardCount?: number }) {
  return (
    <LoadingRegion>
      <View style={styles.replayHeader}>
        <Skeleton width={110} height={20} borderRadius={8} />
        <Skeleton width={56} height={16} />
      </View>
      <View style={styles.replayGrid}>
        {Array.from({ length: cardCount }, (_, index) => (
          <View key={index} style={styles.replayCell}>
            <Skeleton height={108} borderRadius={16} />
            <Skeleton width="72%" height={15} />
            <Skeleton width="42%" height={12} />
          </View>
        ))}
      </View>
    </LoadingRegion>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dayGroups: { gap: PlayTTSpacing.lg },
  stack: { gap: PlayTTSpacing.md },
  divider: { height: StyleSheet.hairlineWidth },
  buttonRow: { flexDirection: "row", gap: PlayTTSpacing.sm },
  statusLine: { marginTop: PlayTTSpacing.xs },
  section: { gap: PlayTTSpacing.xs },
  sectionHeader: { marginLeft: PlayTTSpacing.md },
  group: { borderRadius: KitLayout.groupRadius, borderCurve: "continuous", overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth },
  row: {
    minHeight: KitLayout.rowMinHeight + 8,
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.sm,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.sm,
  },
  rowText: { flex: 1, gap: 6 },
  profile: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.md },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs },
  slotCell: { flexGrow: 1, flexBasis: "45%" },
  dayRow: { flexDirection: "row", gap: PlayTTSpacing.xs, overflow: "hidden" },
  replayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  replayGrid: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.sm },
  replayCell: { width: "48%", flexGrow: 1, maxWidth: "48%", gap: PlayTTSpacing.xs },
})
