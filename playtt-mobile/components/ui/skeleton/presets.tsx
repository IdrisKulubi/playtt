import { StyleSheet, View } from "react-native"

import {
  PlayTTColors,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"

import {
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  type SkeletonSurface,
} from "./skeleton"

import { SESSION_TICKET_THUMB_SIZE } from "@/components/booking/session-ticket-shell"

type PresetProps = {
  surface?: SkeletonSurface
}

export function AuthFormSkeleton({ surface = "product" }: PresetProps) {
  return (
    <SkeletonGroup gap="md" style={styles.authForm}>
      <SkeletonText width="40%" surface={surface} />
      <Skeleton height={52} borderRadius={PlayTTRadius.field} surface={surface} />
      <Skeleton height={52} borderRadius={PlayTTRadius.field} surface={surface} />
      <Skeleton height={52} borderRadius={PlayTTRadius.field} surface={surface} />
      <Skeleton height={52} borderRadius={PlayTTRadius.pill} surface={surface} />
    </SkeletonGroup>
  )
}

export function VenueCardSkeleton({ surface = "product" }: PresetProps) {
  return (
    <SkeletonGroup gap="md" style={styles.venueCard}>
      <View
        style={[
          styles.ticketRow,
          styles.cardShell,
          surface === "product" ? styles.cardShellProduct : styles.cardShellDark,
        ]}
      >
        <Skeleton
          width={SESSION_TICKET_THUMB_SIZE}
          height={SESSION_TICKET_THUMB_SIZE}
          borderRadius={PlayTTRadius.lg}
          surface={surface}
        />
        <SkeletonGroup gap="xs" style={styles.flex}>
          <Skeleton width="55%" height={16} surface={surface} />
          <SkeletonText width="85%" surface={surface} />
        </SkeletonGroup>
      </View>
      <Skeleton height={52} borderRadius={PlayTTRadius.pill} surface={surface} />
    </SkeletonGroup>
  )
}

export function SlotListSkeleton({ surface = "product" }: PresetProps) {
  return (
    <SkeletonGroup gap="md">
      {Array.from({ length: 5 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.slotRow,
            surface === "product" ? styles.cardShellProduct : styles.cardShellDark,
          ]}
        >
          <SkeletonGroup gap="xs" style={styles.flex}>
            <Skeleton width="50%" height={16} surface={surface} />
            <Skeleton width="35%" height={12} surface={surface} />
          </SkeletonGroup>
          <Skeleton width={72} height={16} surface={surface} />
        </View>
      ))}
    </SkeletonGroup>
  )
}

export function TimingPanelSkeleton({ surface = "product" }: PresetProps) {
  return (
    <SkeletonGroup gap="md">
      <Skeleton width="45%" height={20} surface={surface} />
      <View style={styles.dateRow}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            width={56}
            height={56}
            borderRadius={PlayTTRadius.md}
            surface={surface}
          />
        ))}
      </View>
      <View style={styles.toggleRow}>
        <Skeleton height={44} borderRadius={PlayTTRadius.md} surface={surface} style={styles.flex} />
        <Skeleton height={44} borderRadius={PlayTTRadius.md} surface={surface} style={styles.flex} />
      </View>
      <Skeleton width="20%" height={13} surface={surface} />
      <View style={styles.groupRow}>
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton
            key={index}
            width={40}
            height={32}
            borderRadius={PlayTTRadius.pill}
            surface={surface}
          />
        ))}
      </View>
      <SlotListSkeleton surface={surface} />
    </SkeletonGroup>
  )
}

export function BookingListSkeleton({ surface = "dark" }: PresetProps) {
  return (
    <SkeletonGroup gap="md">
      {Array.from({ length: 3 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.ticketRow,
            styles.bookingCard,
            surface === "product" ? styles.cardShellProduct : styles.cardShellDark,
          ]}
        >
          <Skeleton
            width={SESSION_TICKET_THUMB_SIZE}
            height={SESSION_TICKET_THUMB_SIZE}
            borderRadius={PlayTTRadius.lg}
            surface={surface}
          />
          <SkeletonGroup gap="xs" style={styles.flex}>
            <Skeleton width="70%" height={15} surface={surface} />
            <Skeleton width="50%" height={13} surface={surface} />
            <Skeleton width="85%" height={13} surface={surface} />
          </SkeletonGroup>
        </View>
      ))}
    </SkeletonGroup>
  )
}

export function BookingDetailSkeleton({ surface = "dark" }: PresetProps) {
  return (
    <SkeletonGroup gap="sm" style={styles.detail}>
      <Skeleton width="70%" height={28} surface={surface} />
      <Skeleton width="40%" height={15} surface={surface} />
      <Skeleton width="55%" height={22} surface={surface} style={styles.detailTime} />
      <Skeleton width="80%" height={14} surface={surface} />
      <Skeleton width="30%" height={20} surface={surface} />
    </SkeletonGroup>
  )
}

export function AccountHubSkeleton({ surface = "dark" }: PresetProps) {
  return (
    <SkeletonGroup gap="lg" style={styles.accountHub}>
      <SkeletonGroup gap="xs" style={styles.accountHeaderFlat}>
        <Skeleton width={64} height={64} borderRadius={32} surface={surface} />
        <Skeleton width="50%" height={20} surface={surface} />
        <Skeleton width="70%" height={14} surface={surface} />
        <Skeleton width="35%" height={13} surface={surface} />
      </SkeletonGroup>
      <Skeleton width="22%" height={12} surface={surface} />
      <SkeletonGroup gap="sm">
        <Skeleton width="55%" height={16} surface={surface} />
        <Skeleton width="80%" height={13} surface={surface} />
      </SkeletonGroup>
      <Skeleton width="25%" height={12} surface={surface} />
      <Skeleton width="45%" height={16} surface={surface} />
    </SkeletonGroup>
  )
}

export function UpcomingCardSkeleton({ surface = "dark" }: PresetProps) {
  return <HomeTicketSkeleton surface={surface} />
}

type HomeTicketSkeletonProps = PresetProps & {
  embedded?: boolean
}

export function HomeTicketSkeleton({
  surface = "dark",
  embedded = false,
}: HomeTicketSkeletonProps) {
  const shellStyle =
    surface === "product" ? styles.cardShellProduct : styles.cardShellDark

  return (
    <View
      style={[
        styles.homeTicket,
        embedded ? shellStyle : styles.homeTicketStandalone,
        !embedded && shellStyle,
      ]}
    >
      <View style={styles.ticketRow}>
        <Skeleton
          width={SESSION_TICKET_THUMB_SIZE}
          height={SESSION_TICKET_THUMB_SIZE}
          borderRadius={PlayTTRadius.lg}
          surface={surface}
        />
        <SkeletonGroup gap="xs" style={styles.flex}>
          <Skeleton width="75%" height={15} surface={surface} />
          <Skeleton width="50%" height={13} surface={surface} />
          <Skeleton width="65%" height={13} surface={surface} />
        </SkeletonGroup>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  authForm: {
    width: "100%",
    paddingHorizontal: PlayTTSpacing.xl,
    paddingTop: PlayTTSpacing.lg,
  },
  venueCard: {
    width: "100%",
  },
  cardShell: {
    borderRadius: PlayTTRadius.lg,
    borderWidth: 1,
    padding: PlayTTSpacing.md,
    gap: PlayTTSpacing.xs,
  },
  cardShellDark: {
    backgroundColor: PlayTTColors.card,
    borderColor: PlayTTColors.border,
  },
  cardShellProduct: {
    backgroundColor: PlayTTColors.productCard,
    borderColor: PlayTTColors.productBorder,
  },
  dateRow: {
    flexDirection: "row",
    gap: PlayTTSpacing.xs,
  },
  toggleRow: {
    flexDirection: "row",
    gap: PlayTTSpacing.sm,
  },
  groupRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PlayTTSpacing.xs,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: PlayTTRadius.md,
    borderWidth: 1,
    padding: PlayTTSpacing.md,
  },
  bookingCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: PlayTTSpacing.sm,
  },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.sm,
  },
  detail: {
    padding: PlayTTSpacing.xl,
  },
  detailTime: {
    marginTop: PlayTTSpacing.sm,
  },
  upcomingCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: PlayTTSpacing.md,
    gap: PlayTTSpacing.xs,
  },
  homeTicket: {
    borderRadius: PlayTTRadius.lg,
    padding: PlayTTSpacing.sm,
  },
  homeTicketStandalone: {
    borderWidth: 1,
  },
  accountHub: {
    paddingHorizontal: PlayTTSpacing.xl,
    paddingTop: PlayTTSpacing.lg,
  },
  accountHeaderFlat: {
    alignItems: "flex-start",
    paddingBottom: PlayTTSpacing.sm,
  },
  flex: {
    flex: 1,
  },
})
