/**
 * Global skeleton loading primitives and presets.
 *
 * Full screen:
 *   <SkeletonGate loading={isLoading} skeleton={<BookingListSkeleton />}>
 *     <Content />
 *   </SkeletonGate>
 *
 * Inline section:
 *   {isLoadingSlots ? <TimingPanelSkeleton /> : slots.map(...)}
 *
 * Import from `@/components/ui/skeleton` only — do not duplicate skeleton styles.
 */
export {
  Skeleton,
  SkeletonCircle,
  SkeletonGroup,
  SkeletonText,
  type SkeletonProps,
  type SkeletonSurface,
} from "./skeleton"
export { SkeletonGate, type SkeletonGateProps } from "./skeleton-gate"
export {
  AccountHubSkeleton,
  AuthFormSkeleton,
  BookingDetailSkeleton,
  BookingListSkeleton,
  SlotListSkeleton,
  TimingPanelSkeleton,
  HomeTicketSkeleton,
  UpcomingCardSkeleton,
  VenueCardSkeleton,
} from "./presets"
